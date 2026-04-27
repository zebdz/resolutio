import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { getPollByIdAction } from '@/src/web/actions/poll/poll';
import { getParticipantsAction } from '@/src/web/actions/organization/participant';
import ParticipantManagement from '@/src/web/components/polls/participants/ParticipantManagement';
import { Heading } from '@/src/web/components/catalyst/heading';
import { ParticipantWithUser } from '@/src/application/poll/GetParticipantsUseCase';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { User } from '@/domain/user/User';

import {
  prisma,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaOrganizationPropertyRepository,
  PrismaPropertyAssetRepository,
  PrismaVoteRepository,
} from '@/infrastructure/index';
import { PollWeightCalculator } from '@/application/poll/PollWeightCalculator';
import { DistributionType } from '@/domain/poll/DistributionType';
import { PropertyAggregation } from '@/domain/poll/PropertyAggregation';

const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const propertyRepository = new PrismaOrganizationPropertyRepository(prisma);
const propertyAssetRepository = new PrismaPropertyAssetRepository(prisma);
const voteRepository = new PrismaVoteRepository(prisma);
const pollWeightCalculator = new PollWeightCalculator(
  organizationRepository,
  propertyAssetRepository
);

interface ParticipantsPageProps {
  params: Promise<{
    pollId: string;
    locale: string;
  }>;
}

export default async function ParticipantsPage({
  params,
}: ParticipantsPageProps) {
  const t = await getTranslations('poll.participants');
  const user = await getCurrentUser();
  const { pollId } = await params;

  if (!user) {
    redirect('/login');
  }

  // Get poll details
  const pollResult = await getPollByIdAction(pollId);

  if (!pollResult.success) {
    redirect('/polls');
  }

  const poll = pollResult.data;

  // Fetch user's admin organizations and superadmin status for authorization
  const isOrgAdmin = await organizationRepository.isUserAdmin(
    user.id,
    poll.organizationId
  );
  const isSuperAdmin = await userRepository.isSuperAdmin(user.id);
  const canManage = isSuperAdmin || isOrgAdmin;

  // Check if user is the poll creator
  if (!canManage) {
    redirect(`/polls/${pollId}`);
  }

  // Fetch weight-config related data in parallel with participants.
  // Tree-aware property fetch: direct org's properties + descendant orgs' grouped.
  const [
    participantsResult,
    treePropertiesResult,
    orgHasOwnershipResult,
    votesCastResult,
  ] = await Promise.all([
    getParticipantsAction(pollId),
    propertyRepository.findByOrganizationTree(poll.organizationId),
    propertyAssetRepository.orgHasOwnershipData(poll.organizationId),
    voteRepository.pollHasVotes(pollId),
  ]);

  if (!participantsResult.success) {
    return (
      <AuthenticatedLayout>
        <div className="mb-8">
          <Heading>{t('title')}</Heading>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{poll.title}</p>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 bg-white dark:bg-zinc-900">
          <p className="text-red-600 dark:text-red-400">
            {participantsResult.error}
          </p>
        </div>
      </AuthenticatedLayout>
    );
  }

  const participantsData = participantsResult.data;

  // Serialize participants data for client component
  const serializedParticipants = participantsData.participants.map(
    (p: ParticipantWithUser) => ({
      id: p.participant.id,
      userId: p.participant.userId,
      userName: User.formatFullName(
        p.user.firstName,
        p.user.lastName,
        p.user.middleName
      ),
      weight: p.participant.userWeight,
      updatedAt: p.participant.snapshotAt.toISOString(),
    })
  );

  // Serialize properties for client component. First group is direct org
  // (always present, even if empty), rest are descendants.
  const treeGroups = treePropertiesResult.success
    ? treePropertiesResult.value
    : [];
  const properties = (treeGroups[0]?.properties ?? []).map((p) => ({
    id: p.id,
    name: p.name,
  }));
  const descendantGroups = treeGroups.slice(1).map((g) => ({
    orgId: g.orgId,
    orgName: g.orgName,
    properties: g.properties.map((p) => ({ id: p.id, name: p.name })),
  }));

  const orgHasOwnershipData = orgHasOwnershipResult.success
    ? orgHasOwnershipResult.value
    : false;

  const votesCast = votesCastResult.success ? votesCastResult.value : false;

  const weightConfig = {
    distributionType: poll.distributionType,
    propertyAggregation: poll.propertyAggregation,
    propertyIds: poll.propertyIds,
  };

  // "Building total" = theoretical max if every owner were registered. The
  // gap (Building − Registered) is what unregistered owners hold. EQUAL polls
  // have no such gap, so the calculator returns 0 and the UI hides the column.
  const buildingTotalResult = await pollWeightCalculator.computeBuildingTotal({
    organizationId: poll.organizationId,
    distributionType: poll.distributionType as DistributionType,
    propertyAggregation: poll.propertyAggregation as PropertyAggregation,
    propertyIds: poll.propertyIds,
  });
  const buildingTotal = buildingTotalResult.success
    ? buildingTotalResult.value
    : 0;

  return (
    <AuthenticatedLayout>
      <div className="mb-8">
        <Heading>{t('title')}</Heading>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{poll.title}</p>
      </div>

      <ParticipantManagement
        pollId={pollId}
        participantsData={{
          participants: serializedParticipants,
          canModify: participantsData.canModify,
        }}
        pollState={poll.state}
        weightConfig={weightConfig}
        properties={properties}
        descendantGroups={descendantGroups}
        orgHasOwnershipData={orgHasOwnershipData}
        votesCast={votesCast}
        buildingTotal={buildingTotal}
      />
    </AuthenticatedLayout>
  );
}

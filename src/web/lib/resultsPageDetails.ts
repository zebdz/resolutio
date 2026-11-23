/** Add current navigation and permission-filtered report cards to a results view.
 * Only unsealed polls consult live property names and the building denominator. */
import { questionAttachmentFiles } from './questionAttachmentFiles';
import type { Poll } from '@/domain/poll/Poll';
import { PollState } from '@/domain/poll/PollState';
import { isOwnershipMode } from '@/domain/poll/DistributionType';
import type { User } from '@/domain/user/User';
import { success, type Result } from '@/domain/shared/Result';
import { PollAttachmentId, type PollId } from '@/domain/shared/EntityIds';
import {
  prisma,
  PrismaOrganizationPropertyRepository,
  PrismaOrganizationRepository,
  PrismaPropertyAssetRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { PrismaNotificationReader } from '@/infrastructure/repositories/PrismaNotificationReader';
import { PollWeightCalculator } from '@/application/poll/PollWeightCalculator';
import type { NotificationFailure } from '@/application/notification/NotificationErrors';
import { GetUnreadNotificationCountUseCase } from '@/application/notification/GetUnreadNotificationCountUseCase';
import { listReportsAction } from '@/web/actions/report/report';
import type { readPollResults } from './readPollResults';
import type { ResultsPageView } from '@/web/components/polls/results/ResultsPageView';

const users = new PrismaUserRepository(prisma);
const properties = new PrismaOrganizationPropertyRepository(prisma);
const weights = new PollWeightCalculator(
  new PrismaOrganizationRepository(prisma),
  new PrismaPropertyAssetRepository(prisma)
);
const unread = new GetUnreadNotificationCountUseCase({
  notificationReader: new PrismaNotificationReader(prisma),
});

async function reportsForViewer(
  pollId: PollId
): Promise<ResultsPageView['reports']> {
  const list = await listReportsAction({
    attachedPollId: pollId,
    publishedOnly: true,
    pageSize: 20,
  });

  if (!list.success || list.data.reports.length === 0) {
    return [];
  }

  const reports = list.data.reports;
  const authors = await users.findByIds([
    ...new Set(reports.map((report) => report.createdById)),
  ]);
  const names = new Map(
    authors.map((author) => [
      author.id,
      {
        firstName: author.firstName,
        lastName: author.lastName,
        middleName: author.middleName ?? null,
      },
    ])
  );

  return reports.map((report) => ({
    report: {
      id: report.id,
      title: report.title,
      body: report.body,
      state: report.state,
      visibility: report.visibility,
      lastPublishedAt: report.lastPublishedAt,
      createdAt: report.createdAt,
      archivedAt: report.archivedAt,
      organizationId: report.organizationId,
    },
    author: names.get(report.createdById) ?? {
      firstName: '?',
      lastName: '?',
      middleName: null,
    },
  }));
}

async function liveHeading(poll: Poll, user: User) {
  const [allProperties, total] = await Promise.all([
    properties.findByOrganization(poll.organizationId),
    weights.computeBuildingTotal({
      organizationId: poll.organizationId,
      distributionType: poll.distributionType,
      propertyAggregation: poll.propertyAggregation,
      propertyIds: poll.propertyIds,
    }),
  ]);
  const all = allProperties.success ? allProperties.value : [];
  const selected = new Set(poll.propertyIds);
  const count = selected.size || all.length;

  return {
    title: poll.title,
    description: poll.description,
    attachmentIds: poll.attachmentIds,
    distributionType: poll.distributionType,
    propertyAggregation: poll.propertyAggregation,
    scopedPropertyNames: all
      .filter((property) => selected.has(property.id))
      .map((property) => property.name),
    showAggregation: isOwnershipMode(poll.distributionType) && count >= 2,
    buildingTotal: total.success ? (total.value ?? 0) : 0,
    pollState: poll.state,
    isPollCreator: user.id === poll.createdBy,
    isAnonymous: poll.isAnonymous(),
    isOpenPoll: poll.isOpen(),
  };
}

type Source = Extract<
  Awaited<ReturnType<typeof readPollResults>>,
  { success: true }
>['value'];

export async function resultsPageDetails(
  pollId: PollId,
  user: User,
  source: Source
): Promise<Result<ResultsPageView, NotificationFailure>> {
  const [isSuperAdmin, unreadCount, reports, questionFiles, heading] =
    await Promise.all([
      users.isSuperAdmin(user.id),
      unread.execute({ userId: user.id }),
      reportsForViewer(pollId),
      questionAttachmentFiles(
        pollId,
        user.id,
        source.kind === 'sealed' ? source.data.questionFiles : undefined
      ),
      source.kind === 'live'
        ? liveHeading(source.poll, user)
        : {
            title: source.data.title,
            description: source.data.description,
            attachmentIds: source.data.attachmentIds.map((id) =>
              PollAttachmentId.parse(id)
            ),
            distributionType: source.data.distributionType,
            propertyAggregation: source.data.propertyAggregation,
            scopedPropertyNames: source.data.scopedPropertyNames,
            showAggregation: source.data.showAggregation,
            isPollCreator: source.data.isPollCreator,
            isAnonymous: source.data.isAnonymous,
            isOpenPoll: source.data.isOpenPoll,
            buildingTotal: 0,
            pollState: PollState.FINISHED,
          },
    ]);

  if (!unreadCount.success) {
    return unreadCount;
  }

  return success({
    ...heading,
    questionFiles,
    results: source.data.results,
    canViewVoterNames: source.data.canViewVoterNames,
    canViewSignWillingness: source.data.canViewSignWillingness,
    coverage:
      source.kind === 'sealed'
        ? {
            kind: 'sealed',
            seal: source.seal,
            hasOwnVote: source.data.hasOwnVote,
          }
        : { kind: source.coverage },
    reports,
    navigation: {
      firstName: user.firstName,
      isSuperAdmin,
      unreadNotificationCount: unreadCount.value.count,
    },
  });
}

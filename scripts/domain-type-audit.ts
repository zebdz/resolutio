/** Compiler-backed guard for meaningful domain state and repository identity/unit contracts.
 * Explicit DTO exceptions are reviewed decoding/wire boundaries; aliases cannot hide primitive state. */
import ts from 'typescript';
import { relative, resolve } from 'node:path';

// These records are untrusted persistence/request input or canonical wire formats, not retained state.
// Their constructors/decoders are covered by runtime boundary tests; adding a record requires review.
const rawContracts: Readonly<Record<string, readonly string[]>> = {
  'ai/LegalCheck.ts': ['RawLegalCheckProps'],
  'board/Board.ts': ['BoardData'],
  'invitation/Invitation.ts': ['InvitationData'],
  'notification/Notification.ts': ['NotificationProps'],
  'organization/JoinParentRequest.ts': [
    'JoinParentRequestProps',
    'RawJoinParentRequestProps',
  ],
  'organization/JoinToken.ts': ['JoinTokenProps'],
  'organization/Organization.ts': ['OrganizationProps'],
  'organization/OrganizationProperty.ts': ['OrganizationPropertyProps'],
  'organization/PropertyAsset.ts': ['PropertyAssetProps'],
  'organization/PropertyAssetOwnership.ts': ['PropertyAssetOwnershipProps'],
  'organization/PropertyClaim.ts': ['PropertyClaimProps'],
  'organization/PropertyClaimAttachment.ts': [
    'ReconstituteInput',
    'parsePropertyClaimAttachmentMetadata',
  ],
  'otp/OtpVerification.ts': ['RawOtpVerificationProps'],
  'poll/Answer.ts': ['AnswerData'],
  'poll/ParticipantWeightHistory.ts': ['ParticipantWeightHistoryData'],
  'poll/Poll.ts': ['PollData'],
  'poll/PollAttachment.ts': [
    'ReconstituteInput',
    'parsePollAttachmentMetadata',
  ],
  'poll/PollEligibleMember.ts': ['PollEligibleMemberData'],
  'poll/PollParticipant.ts': ['PollParticipantData'],
  'poll/PollWeightConfig.ts': ['parsePollWeightConfig'],
  'poll/Question.ts': ['QuestionReconstitutionData'],
  'poll/Vote.ts': ['VoteData'],
  'poll/VoteDraft.ts': ['VoteDraftData'],
  'report/Report.ts': ['ReportData'],
  'report/ReportAttachment.ts': [
    'ReconstituteInput',
    'parseReportAttachmentMetadata',
  ],
  'seal/RecordFormat.ts': ['SealedVote', 'SealedRecord'],
  'seal/SealInput.ts': ['SealParticipant', 'SealInput'],
  'seal/VoteReceipt.ts': ['ReceiptData', 'ReceiptInput'],
  'user/Address.ts': ['AddressProps'],
  'user/Session.ts': ['RawSessionProps'],
  'user/User.ts': ['RawUserProps'],
  'user/UserModeration.ts': ['createUserModerationEntry'],
};

const meaningfulField =
  /^(?:id|size|weight|count|share|state|status|type|pollType|questionType|distributionType|propertyAggregation|language|receiptSecret|rootDigest|hash|attempts|maxAttempts|maxUses)$|(?:Id|Ids|Weight|Count|Size|Bytes|Seconds|Minutes|Percentage|Share|At|Date|From|Until)$/;

export interface DomainTypeLeak {
  file: string;
  declaration: string;
  field: string;
  type: string;
}

function ownerName(node: ts.Node): string {
  let owner: ts.Node | undefined = node.parent;

  while (owner) {
    if (
      ts.isInterfaceDeclaration(owner) ||
      ts.isTypeAliasDeclaration(owner) ||
      ts.isClassDeclaration(owner) ||
      ts.isFunctionDeclaration(owner)
    ) {
      return owner.name?.getText() ?? '<anonymous>';
    }

    owner = owner.parent;
  }

  return '<anonymous>';
}

function isPrimitiveContract(type: ts.Type, checker: ts.TypeChecker): boolean {
  if (type.isUnion()) {
    return type.types.some((member) => isPrimitiveContract(member, checker));
  }

  if (
    type.flags &
    (ts.TypeFlags.String |
      ts.TypeFlags.Number |
      ts.TypeFlags.Any |
      ts.TypeFlags.Unknown)
  ) {
    return true;
  }

  if (type.getSymbol()?.getName() === 'Date') {
    return true;
  }

  if (checker.isArrayType(type)) {
    const element = type.getNumberIndexType();

    return element !== undefined && isPrimitiveContract(element, checker);
  }

  return false;
}

export function findDomainTypeLeaks(
  program: ts.Program,
  domainRoot: string
): DomainTypeLeak[] {
  const checker = program.getTypeChecker();
  const leaks: DomainTypeLeak[] = [];
  const root = resolve(domainRoot);

  for (const source of program.getSourceFiles()) {
    const file = relative(root, resolve(source.fileName)).replaceAll('\\', '/');

    if (
      file.startsWith('../') ||
      source.isDeclarationFile ||
      file.includes('/__tests__/')
    ) {
      continue;
    }

    function visit(node: ts.Node) {
      const property =
        ts.isPropertySignature(node) || ts.isPropertyDeclaration(node);
      const parameter =
        ts.isParameter(node) &&
        (ts.isMethodSignature(node.parent) ||
          (ts.isConstructorDeclaration(node.parent) &&
            node.modifiers?.some((modifier) =>
              [
                ts.SyntaxKind.PrivateKeyword,
                ts.SyntaxKind.ProtectedKeyword,
                ts.SyntaxKind.PublicKeyword,
                ts.SyntaxKind.ReadonlyKeyword,
              ].includes(modifier.kind)
            )));

      if ((property || parameter) && node.name) {
        const field = node.name.getText(source);
        const declaration = ownerName(node);
        const raw = rawContracts[file]?.includes(declaration);
        // Notification snapshots deliberately expose detached mutable Dates for existing transports.
        const detachedDate =
          file === 'notification/Notification.ts' &&
          declaration === 'NotificationSnapshot' &&
          ['readAt', 'createdAt'].includes(field);

        if (meaningfulField.test(field) && !raw && !detachedDate) {
          const type = checker.getTypeAtLocation(node);

          if (isPrimitiveContract(type, checker)) {
            leaks.push({
              file,
              declaration,
              field,
              type: checker.typeToString(type),
            });
          }
        }
      }

      ts.forEachChild(node, visit);
    }

    visit(source);
  }

  return leaks;
}

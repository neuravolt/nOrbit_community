import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private prismaClient: PrismaClient;
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const client = new PrismaClient();

    // PayrollConfigAuditLog must be append-only — every write to payroll config
    // creates a new PayrollConfigVersion, and this log records the diff. Blocking
    // update/delete at the client level means no service code path, present or
    // future, can silently rewrite audit history. Prisma 6 has no $use
    // middleware; this is the Client Extensions equivalent.
    //
    // REMOVED: the app-wide $allModels pre-dispatch diagnostic that used to live here. It found
    // two real N+1 bugs (GuardianRepository.findAgentById at 492x, then findAssetById at 1552x
    // once the first was fixed) — but it did `JSON.stringify(args).slice(0, 300)` on the FULL
    // args object for every single query across the entire app, meaning it fully serialized
    // potentially large objects into memory before throwing away 99.9% of the string. Confirmed
    // the underlying explosion is fast enough (GB within single-digit seconds) that any added
    // per-query overhead under load is a real liability, not a neutral observer — removed now
    // that it's served its purpose, rather than leave it running as an open question.
    this.prismaClient = client.$extends({
      query: {
        payrollConfigAuditLog: {
          async $allOperations({ operation, args, query }) {
            if (
              [
                'update',
                'updateMany',
                'delete',
                'deleteMany',
                'upsert',
              ].includes(operation)
            ) {
              throw new Error(
                'PayrollConfigAuditLog is append-only: update/delete is not permitted.',
              );
            }
            return query(args);
          },
        },
        // A payroll run's snapshot is captured once at calculation time and
        // never touched again — reproducibility depends on this being an
        // absolute, unconditional guarantee rather than a service-layer check
        // that some future code path could forget to make. Full FINALIZED/
        // LOCKED PayrollRun-level immutability (can this run still be
        // recalculated at all) is enforced in PayrollWorkflowService instead,
        // since that decision needs to read the run's current status first.
        payrollRunSnapshot: {
          async $allOperations({ operation, args, query }) {
            if (
              [
                'update',
                'updateMany',
                'delete',
                'deleteMany',
                'upsert',
              ].includes(operation)
            ) {
              throw new Error(
                'PayrollRunSnapshot is immutable: update/delete is not permitted.',
              );
            }
            return query(args);
          },
        },
        // Same append-only guarantee as PayrollConfigAuditLog, generalized to
        // every payroll entity's audit trail (components, holidays, working
        // week, tax config, adjustments, employee overrides).
        payrollAuditLog: {
          async $allOperations({ operation, args, query }) {
            if (
              [
                'update',
                'updateMany',
                'delete',
                'deleteMany',
                'upsert',
              ].includes(operation)
            ) {
              throw new Error(
                'PayrollAuditLog is append-only: update/delete is not permitted.',
              );
            }
            return query(args);
          },
        },
      },
    }) as unknown as PrismaClient;
  }

  async onModuleInit() {
    await this.prismaClient.$connect();
  }

  async onModuleDestroy() {
    await this.prismaClient.$disconnect();
  }

  // Expose all PrismaClient methods via proxy
  get biometricProfile() {
    return (
      (this.prismaClient as any).biometricProfile ||
      (this.prismaClient as any).BiometricProfile
    );
  }

  get faceProfile() {
    return (
      (this.prismaClient as any).faceProfile ||
      (this.prismaClient as any).FaceProfile
    );
  }

  get biometricAuditLog() {
    return (
      (this.prismaClient as any).biometricAuditLog ||
      (this.prismaClient as any).BiometricAuditLog
    );
  }

  get consentRegistry() {
    return (
      (this.prismaClient as any).consentRegistry ||
      (this.prismaClient as any).ConsentRegistry
    );
  }

  get meeting() {
    return this.prismaClient.meeting;
  }

  get user() {
    return this.prismaClient.user;
  }

  get userRole() {
    return this.prismaClient.userRole;
  }

  get role() {
    return this.prismaClient.role;
  }

  get permission() {
    return this.prismaClient.permission;
  }

  get rolePermission() {
    return this.prismaClient.rolePermission;
  }

  get team() {
    return this.prismaClient.team;
  }

  get taskAssignment() {
    return this.prismaClient.taskAssignment;
  }

  get timeLog() {
    return this.prismaClient.timeLog;
  }

  get auditLog() {
    return this.prismaClient.auditLog;
  }

  get comment() {
    return this.prismaClient.comment;
  }

  get ticket() {
    return this.prismaClient.ticket;
  }

  get lead() {
    return this.prismaClient.lead;
  }

  get note() {
    return this.prismaClient.note;
  }

  get activity() {
    return this.prismaClient.activity;
  }

  get contact() {
    return this.prismaClient.contactPerson;
  }

  get contactPerson() {
    return this.prismaClient.contactPerson;
  }

  get client() {
    return this.prismaClient.client;
  }

  get project() {
    return this.prismaClient.project;
  }

  get milestone() {
    return this.prismaClient.milestone;
  }

  get task() {
    return this.prismaClient.task;
  }

  get amcContract() {
    return (
      (this.prismaClient as any).amcContract ||
      (this.prismaClient as any).aMCContract
    );
  }

  get invoice() {
    return this.prismaClient.invoice;
  }

  get invoiceItem() {
    return this.prismaClient.invoiceItem;
  }

  get asset() {
    return this.prismaClient.asset;
  }

  get quote() {
    return this.prismaClient.quote;
  }

  get quoteLineItem() {
    return this.prismaClient.quoteLineItem;
  }

  get amcHourLog() {
    return this.prismaClient.amcHourLog;
  }

  get payment() {
    return this.prismaClient.payment;
  }

  get companyProfile() {
    return this.prismaClient.companyProfile;
  }

  get amcWeeklyReport() {
    return this.prismaClient.amcWeeklyReport;
  }

  get notification() {
    return this.prismaClient.notification;
  }

  get serviceCatalog() {
    return this.prismaClient.serviceCatalog;
  }

  get serviceRateCard() {
    return this.prismaClient.serviceRateCard;
  }

  get serviceBundle() {
    return this.prismaClient.serviceBundle;
  }

  get attachment() {
    return this.prismaClient.attachment;
  }

  get bugReport() {
    return this.prismaClient.bugReport;
  }

  get testCase() {
    return this.prismaClient.testCase;
  }

  get clientUser() {
    return this.prismaClient.clientUser;
  }

  get emailTemplate() {
    return this.prismaClient.emailTemplate;
  }

  get emailTemplateVersion() {
    return this.prismaClient.emailTemplateVersion;
  }

  get sentEmail() {
    return this.prismaClient.sentEmail;
  }

  get domain() {
    return this.prismaClient.domain;
  }

  get hosting() {
    return this.prismaClient.hosting;
  }

  get vpsServer() {
    return this.prismaClient.vpsServer;
  }

  // ==================== LAUNCHPAD GETTERS ====================
  get launchpadConfig() {
    return this.prismaClient.launchpadConfig;
  }

  get launchpadTrack() {
    return this.prismaClient.launchpadTrack;
  }

  get launchpadTaskCategory() {
    return this.prismaClient.launchpadTaskCategory;
  }

  get launchpadStudent() {
    return this.prismaClient.launchpadStudent;
  }

  get launchpadTask() {
    return this.prismaClient.launchpadTask;
  }

  get launchpadSubmission() {
    return this.prismaClient.launchpadSubmission;
  }

  get launchpadLead() {
    return this.prismaClient.launchpadLead;
  }

  get launchpadQualityRule() {
    return this.prismaClient.launchpadQualityRule;
  }

  get launchpadLevel() {
    return this.prismaClient.launchpadLevel;
  }

  get launchpadReward() {
    return this.prismaClient.launchpadReward;
  }

  get launchpadRedemption() {
    return this.prismaClient.launchpadRedemption;
  }

  get launchpadBadgeTemplate() {
    return this.prismaClient.launchpadBadgeTemplate;
  }

  get launchpadBadge() {
    return this.prismaClient.launchpadBadge;
  }

  get launchpadPointTransaction() {
    return this.prismaClient.launchpadPointTransaction;
  }

  get launchpadProjectAssignment() {
    return this.prismaClient.launchpadProjectAssignment;
  }

  get launchpadNotification() {
    return this.prismaClient.launchpadNotification;
  }

  get launchpadTimeLog() {
    return this.prismaClient.launchpadTimeLog;
  }

  get launchpadEmailTemplate() {
    return this.prismaClient.launchpadEmailTemplate;
  }

  get launchpadTrainingModule() {
    return this.prismaClient.launchpadTrainingModule;
  }

  get launchpadTrainingCompletion() {
    return this.prismaClient.launchpadTrainingCompletion;
  }

  get launchpadAuditLog() {
    return this.prismaClient.launchpadAuditLog;
  }

  get launchpadAssessmentQuestion() {
    return this.prismaClient.launchpadAssessmentQuestion;
  }

  get launchpadAssessmentAnswer() {
    return this.prismaClient.launchpadAssessmentAnswer;
  }

  get launchpadAssessmentSession() {
    return this.prismaClient.launchpadAssessmentSession;
  }

  get launchpadAssessmentResponse() {
    return this.prismaClient.launchpadAssessmentResponse;
  }

  get launchpadCareerRecommendation() {
    return this.prismaClient.launchpadCareerRecommendation;
  }

  get launchpadEvidenceSource() {
    return this.prismaClient.launchpadEvidenceSource;
  }

  get launchpadEvidenceItem() {
    return this.prismaClient.launchpadEvidenceItem;
  }

  get launchpadSkillDefinition() {
    return this.prismaClient.launchpadSkillDefinition;
  }

  get launchpadUserSkill() {
    return this.prismaClient.launchpadUserSkill;
  }

  get launchpadWallet() {
    return this.prismaClient.launchpadWallet;
  }

  get launchpadWalletTransaction() {
    return this.prismaClient.launchpadWalletTransaction;
  }

  get launchpadMarketplaceTask() {
    return this.prismaClient.launchpadMarketplaceTask;
  }

  get launchpadTaskCreator() {
    return this.prismaClient.launchpadTaskCreator;
  }

  get launchpadTaskClaim() {
    return this.prismaClient.launchpadTaskClaim;
  }

  get launchpadRoleSkill() {
    return this.prismaClient.launchpadRoleSkill;
  }

  get launchpadTaskStep() {
    return this.prismaClient.launchpadTaskStep;
  }

  get launchpadTaskPrerequisite() {
    return this.prismaClient.launchpadTaskPrerequisite;
  }

  get launchpadStudentTaskProgress() {
    return this.prismaClient.launchpadStudentTaskProgress;
  }

  get launchpadTaskStepSubmission() {
    return this.prismaClient.launchpadTaskStepSubmission;
  }

  get launchpadVerificationPolicy() {
    return this.prismaClient.launchpadVerificationPolicy;
  }

  get launchpadFeatureFlag() {
    return this.prismaClient.launchpadFeatureFlag;
  }

  get launchpadCareerProfile() {
    return this.prismaClient.launchpadCareerProfile;
  }

  get launchpadSkillHistory() {
    return this.prismaClient.launchpadSkillHistory;
  }

  get launchpadSkillEvidence() {
    return this.prismaClient.launchpadSkillEvidence;
  }

  get launchpadVerificationQueue() {
    return this.prismaClient.launchpadVerificationQueue;
  }

  get launchpadVerificationResult() {
    return this.prismaClient.launchpadVerificationResult;
  }

  get launchpadGrowthIndex() {
    return this.prismaClient.launchpadGrowthIndex;
  }

  get launchpadTrustScore() {
    return this.prismaClient.launchpadTrustScore;
  }

  get launchpadSkillScore() {
    return this.prismaClient.launchpadSkillScore;
  }

  get launchpadEmployabilityScore() {
    return this.prismaClient.launchpadEmployabilityScore;
  }

  get githubAccount() {
    return this.prismaClient.githubAccount;
  }

  get githubRepository() {
    return this.prismaClient.githubRepository;
  }

  get githubCommit() {
    return this.prismaClient.githubCommit;
  }

  get githubPullRequest() {
    return this.prismaClient.githubPullRequest;
  }

  get githubReview() {
    return this.prismaClient.githubReview;
  }

  get githubIssue() {
    return this.prismaClient.githubIssue;
  }

  get githubWebhook() {
    return this.prismaClient.githubWebhook;
  }

  get projectTaskCounter() {
    return this.prismaClient.projectTaskCounter;
  }

  get taskPullRequest() {
    return this.prismaClient.taskPullRequest;
  }

  get projectReleaseNote() {
    return this.prismaClient.projectReleaseNote;
  }

  // Issue #11: Internal Task Board
  get launchpadInternalTask() {
    return this.prismaClient.launchpadInternalTask;
  }

  // Issue #12: Communication Hub
  get launchpadConversation() {
    return this.prismaClient.launchpadConversation;
  }

  get launchpadMessage() {
    return this.prismaClient.launchpadMessage;
  }

  get launchpadMessageRead() {
    return this.prismaClient.launchpadMessageRead;
  }

  // Issue #13: Calendar & Scheduling
  get launchpadCalendarEvent() {
    return this.prismaClient.launchpadCalendarEvent;
  }

  get launchpadMentorSchedule() {
    return this.prismaClient.launchpadMentorSchedule;
  }

  get launchpadBooking() {
    return this.prismaClient.launchpadBooking;
  }

  get launchpadReminder() {
    return this.prismaClient.launchpadReminder;
  }

  // Issue #14: Collaboration
  get launchpadCollaborationSession() {
    return this.prismaClient.launchpadCollaborationSession;
  }

  // Issue #15: Pipeline
  get launchpadPipelineProject() {
    return this.prismaClient.launchpadPipelineProject;
  }
  get launchpadPipelineSprint() {
    return this.prismaClient.launchpadPipelineSprint;
  }
  get launchpadPipelineTask() {
    return this.prismaClient.launchpadPipelineTask;
  }
  get launchpadPipelineTeamMember() {
    return this.prismaClient.launchpadPipelineTeamMember;
  }
  get launchpadPipelineRevenueShare() {
    return this.prismaClient.launchpadPipelineRevenueShare;
  }
  get launchpadPipelineDependency() {
    return this.prismaClient.launchpadPipelineDependency;
  }

  // Issue #17: Fraud
  get launchpadFraudFlag() {
    return this.prismaClient.launchpadFraudFlag;
  }
  get launchpadFraudInvestigation() {
    return this.prismaClient.launchpadFraudInvestigation;
  }
  get launchpadIpLog() {
    return this.prismaClient.launchpadIpLog;
  }
  get launchpadDeviceFingerprint() {
    return this.prismaClient.launchpadDeviceFingerprint;
  }

  // Issue #18: Disputes
  get launchpadDispute() {
    return this.prismaClient.launchpadDispute;
  }
  get launchpadDisputeEvidence() {
    return this.prismaClient.launchpadDisputeEvidence;
  }
  get launchpadDisputeResolution() {
    return this.prismaClient.launchpadDisputeResolution;
  }
  get launchpadDisputeAppeal() {
    return this.prismaClient.launchpadDisputeAppeal;
  }

  // Issue #19: Analytics
  get launchpadAnalyticsEvent() {
    return this.prismaClient.launchpadAnalyticsEvent;
  }
  get launchpadAnalyticsAggregate() {
    return this.prismaClient.launchpadAnalyticsAggregate;
  }
  get launchpadAbTest() {
    return this.prismaClient.launchpadAbTest;
  }
  get launchpadCohort() {
    return this.prismaClient.launchpadCohort;
  }

  // Issue #20: Operations
  get launchpadIncident() {
    return this.prismaClient.launchpadIncident;
  }
  get launchpadRunbook() {
    return this.prismaClient.launchpadRunbook;
  }
  get launchpadMaintenanceWindow() {
    return this.prismaClient.launchpadMaintenanceWindow;
  }
  get launchpadSystemHealth() {
    return this.prismaClient.launchpadSystemHealth;
  }

  // Issue #16: Organization & College Partnership
  get launchpadPartner() {
    return this.prismaClient.launchpadPartner;
  }
  get launchpadPartnerUser() {
    return this.prismaClient.launchpadPartnerUser;
  }
  get launchpadBatch() {
    return this.prismaClient.launchpadBatch;
  }
  get launchpadBatchEnrollment() {
    return this.prismaClient.launchpadBatchEnrollment;
  }
  get launchpadPartnerCurriculum() {
    return this.prismaClient.launchpadPartnerCurriculum;
  }
  get launchpadPartnerReport() {
    return this.prismaClient.launchpadPartnerReport;
  }

  get launchpadIntegration() {
    return this.prismaClient.launchpadIntegration;
  }

  get launchpadWebhookLog() {
    return this.prismaClient.launchpadWebhookLog;
  }

  get refreshToken() {
    return this.prismaClient.refreshToken;
  }

  // ==================== ROADMAP ENGINE GETTERS ====================
  get launchpadCareer() {
    return this.prismaClient.launchpadCareer;
  }

  get launchpadCareerRole() {
    return this.prismaClient.launchpadCareerRole;
  }

  get launchpadTechnology() {
    return this.prismaClient.launchpadTechnology;
  }

  get launchpadTechnologyLevel() {
    return this.prismaClient.launchpadTechnologyLevel;
  }

  get launchpadTechnologyPlugin() {
    return this.prismaClient.launchpadTechnologyPlugin;
  }

  get launchpadTechnologySlugAlias() {
    return this.prismaClient.launchpadTechnologySlugAlias;
  }

  get launchpadRoadmapNode() {
    return this.prismaClient.launchpadRoadmapNode;
  }

  get launchpadContentVersion() {
    return this.prismaClient.launchpadContentVersion;
  }

  get launchpadStaleMarker() {
    return this.prismaClient.launchpadStaleMarker;
  }

  get launchpadChapter() {
    return this.prismaClient.launchpadChapter;
  }

  get launchpadTopic() {
    return this.prismaClient.launchpadTopic;
  }

  get launchpadStudentTechnologyProgress() {
    return this.prismaClient.launchpadStudentTechnologyProgress;
  }

  get launchpadStudentNodeProgress() {
    return this.prismaClient.launchpadStudentNodeProgress;
  }

  get launchpadAiPrompt() {
    return this.prismaClient.launchpadAiPrompt;
  }

  get launchpadAiGenerationJob() {
    return this.prismaClient.launchpadAiGenerationJob;
  }

  get launchpadCurriculumGenerationRun() {
    return this.prismaClient.launchpadCurriculumGenerationRun;
  }

  get launchpadGithubRoadmapRepo() {
    return this.prismaClient.launchpadGithubRoadmapRepo;
  }

  // ==================== NEW ROADMAP ENGINE MODEL GETTERS ====================
  get career() {
    return this.prismaClient.career;
  }

  get careerRole() {
    return this.prismaClient.careerRole;
  }

  get technology() {
    return this.prismaClient.technology;
  }

  get technologyLevel() {
    return this.prismaClient.technologyLevel;
  }

  get roadmapNode() {
    return this.prismaClient.roadmapNode;
  }

  get studentTechnologyProgress() {
    return this.prismaClient.studentTechnologyProgress;
  }

  get studentNodeProgress() {
    return this.prismaClient.studentNodeProgress;
  }

  get evidence() {
    return this.prismaClient.evidence;
  }

  get mentorReview() {
    return this.prismaClient.mentorReview;
  }

  get aIPrompt() {
    return this.prismaClient.aIPrompt;
  }

  get aIGenerationJob() {
    return this.prismaClient.aIGenerationJob;
  }

  get gitHubRoadmapRepo() {
    return this.prismaClient.gitHubRoadmapRepo;
  }

  get challengeTestSuite() {
    return this.prismaClient.challengeTestSuite;
  }

  get launchpadChallengeVerificationContract() {
    return this.prismaClient.launchpadChallengeVerificationContract;
  }

  get challengeEvaluationReport() {
    return this.prismaClient.challengeEvaluationReport;
  }

  get challengeScoreVersion() {
    return this.prismaClient.challengeScoreVersion;
  }

  get peerReviewAssignment() {
    return this.prismaClient.peerReviewAssignment;
  }

  // Phase B1 (Roadmap Runtime Verification Architecture): template/instance-based challenge
  // generation — see ChallengeTemplateService / ChallengeInstanceGeneratorService.
  get challengeTemplate() {
    return this.prismaClient.challengeTemplate;
  }

  get challengeInstance() {
    return this.prismaClient.challengeInstance;
  }

  // ==================== GUARDIAN AGENT GETTERS ====================
  get guardianAgent() {
    return this.prismaClient.guardianAgent;
  }

  get guardianInstallToken() {
    return this.prismaClient.guardianInstallToken;
  }

  get guardianCommand() {
    return this.prismaClient.guardianCommand;
  }

  get guardianDiscovery() {
    return this.prismaClient.guardianDiscovery;
  }

  get guardianMonitor() {
    return this.prismaClient.guardianMonitor;
  }

  get guardianAlert() {
    return this.prismaClient.guardianAlert;
  }

  get nginxConfig() {
    return this.prismaClient.nginxConfig;
  }

  get guardianIncidentMemory() {
    return this.prismaClient.guardianIncidentMemory;
  }

  get guardianSecurityStatus() {
    return this.prismaClient.guardianSecurityStatus;
  }

  get guardianMalwareScan() {
    return this.prismaClient.guardianMalwareScan;
  }

  get guardianInfection() {
    return this.prismaClient.guardianInfection;
  }

  get guardianWordPressScan() {
    return this.prismaClient.guardianWordPressScan;
  }

  get guardianQuarantineRecord() {
    return this.prismaClient.guardianQuarantineRecord;
  }

  // Guardian Core load-safe architecture (Phase 1) — Planes 1/3/4 data models.
  get domainObservation() {
    return this.prismaClient.domainObservation;
  }

  get tLSObservation() {
    return this.prismaClient.tLSObservation;
  }

  get securityFinding() {
    return this.prismaClient.securityFinding;
  }

  get fleetOperation() {
    return this.prismaClient.fleetOperation;
  }

  get fleetOperationTarget() {
    return this.prismaClient.fleetOperationTarget;
  }

  get guardianFileScanCursor() {
    return this.prismaClient.guardianFileScanCursor;
  }

  get clientEnterpriseSetting() {
    return this.prismaClient.clientEnterpriseSetting;
  }

  get autonomousAction() {
    return this.prismaClient.autonomousAction;
  }

  get guardianLearningLog() {
    return this.prismaClient.guardianLearningLog;
  }

  // ==================== ACCOUNTING GETTERS ====================
  get purchaseEntry() {
    return this.prismaClient.purchaseEntry;
  }

  get expenseEntry() {
    return this.prismaClient.expenseEntry;
  }

  get bankTransaction() {
    return this.prismaClient.bankTransaction;
  }

  get cashTransaction() {
    return this.prismaClient.cashTransaction;
  }

  get salaryEntry() {
    return this.prismaClient.salaryEntry;
  }

  // HR Module
  get hrDocument() {
    return this.prismaClient.hrDocument;
  }

  get attendance() {
    return this.prismaClient.attendance;
  }

  get leaveRequest() {
    return this.prismaClient.leaveRequest;
  }

  // Enterprise HRMS & NORBIT Multi-Tenancy
  get organization() {
    return this.prismaClient.organization;
  }
  get organizationSettings() {
    return this.prismaClient.organizationSettings;
  }
  get organizationMember() {
    return this.prismaClient.organizationMember;
  }
  get organizationInvitation() {
    return this.prismaClient.organizationInvitation;
  }
  get plan() {
    return this.prismaClient.plan;
  }
  get organizationSubscription() {
    return this.prismaClient.organizationSubscription;
  }
  get department() {
    return this.prismaClient.department;
  }
  get designation() {
    return this.prismaClient.designation;
  }
  get branch() {
    return this.prismaClient.branch;
  }
  get employeeProfile() {
    return this.prismaClient.employeeProfile;
  }
  get employeeEducation() {
    return this.prismaClient.employeeEducation;
  }
  get employeeExperience() {
    return this.prismaClient.employeeExperience;
  }
  get employeeSkill() {
    return this.prismaClient.employeeSkill;
  }
  get systemFile() {
    return this.prismaClient.systemFile;
  }
  get employeeDocument() {
    return this.prismaClient.employeeDocument;
  }
  get officeAsset() {
    return this.prismaClient.officeAsset;
  }
  get officeAssetAssignment() {
    return this.prismaClient.officeAssetAssignment;
  }
  get officeAssetHistory() {
    return this.prismaClient.officeAssetHistory;
  }
  get jobOpening() {
    return this.prismaClient.jobOpening;
  }
  get candidate() {
    return this.prismaClient.candidate;
  }
  get interviewRound() {
    return this.prismaClient.interviewRound;
  }
  get attendanceBreak() {
    return this.prismaClient.attendanceBreak;
  }
  get geoFence() {
    return this.prismaClient.geoFence;
  }
  get leavePolicy() {
    return this.prismaClient.leavePolicy;
  }
  get leavePolicyRule() {
    return this.prismaClient.leavePolicyRule;
  }
  get employeeLeavePolicy() {
    return this.prismaClient.employeeLeavePolicy;
  }
  get leaveBalance() {
    return this.prismaClient.leaveBalance;
  }
  get leaveCycle() {
    return this.prismaClient.leaveCycle;
  }
  get companyHoliday() {
    return this.prismaClient.companyHoliday;
  }
  get leaveLedger() {
    return this.prismaClient.leaveLedger;
  }
  get approvalDelegation() {
    return this.prismaClient.approvalDelegation;
  }
  get leaveApprovalStep() {
    return this.prismaClient.leaveApprovalStep;
  }
  get expenseClaim() {
    return this.prismaClient.expenseClaim;
  }
  get expenseAttachment() {
    return this.prismaClient.expenseAttachment;
  }
  get hrHelpdeskTicket() {
    return this.prismaClient.hrHelpdeskTicket;
  }
  get approvalWorkflow() {
    return this.prismaClient.approvalWorkflow;
  }
  get approvalStep() {
    return this.prismaClient.approvalStep;
  }
  get approvalHistory() {
    return this.prismaClient.approvalHistory;
  }
  get performanceGoal() {
    return this.prismaClient.performanceGoal;
  }
  get performanceReview() {
    return this.prismaClient.performanceReview;
  }
  get payrollRun() {
    return this.prismaClient.payrollRun;
  }
  get payslip() {
    return this.prismaClient.payslip;
  }
  get payrollConfigVersion() {
    return this.prismaClient.payrollConfigVersion;
  }
  get payrollConfigAuditLog() {
    return this.prismaClient.payrollConfigAuditLog;
  }

  // ==================== ENTERPRISE PAYROLL ENGINE GETTERS ====================
  get salaryComponent() {
    return this.prismaClient.salaryComponent;
  }
  get employeeSalaryComponent() {
    return this.prismaClient.employeeSalaryComponent;
  }
  get payrollAdjustment() {
    return this.prismaClient.payrollAdjustment;
  }
  get holidayCalendar() {
    return this.prismaClient.holidayCalendar;
  }
  get holiday() {
    return this.prismaClient.holiday;
  }
  get holidayCalendarAssignment() {
    return this.prismaClient.holidayCalendarAssignment;
  }
  get workingWeek() {
    return this.prismaClient.workingWeek;
  }
  get taxRegimeConfig() {
    return this.prismaClient.taxRegimeConfig;
  }
  get taxSlab() {
    return this.prismaClient.taxSlab;
  }
  get taxSurchargeSlab() {
    return this.prismaClient.taxSurchargeSlab;
  }
  get taxExemption() {
    return this.prismaClient.taxExemption;
  }
  get overtimeConfig() {
    return this.prismaClient.overtimeConfig;
  }
  get overtimeEntry() {
    return this.prismaClient.overtimeEntry;
  }
  get payrollRunSnapshot() {
    return this.prismaClient.payrollRunSnapshot;
  }
  get payrollAuditLog() {
    return this.prismaClient.payrollAuditLog;
  }
  get employeeSalary() {
    return this.prismaClient.employeeSalary;
  }
  get hrmsNotification() {
    return this.prismaClient.hrmsNotification;
  }
  get notificationPreference() {
    return this.prismaClient.notificationPreference;
  }
  get notificationLog() {
    return this.prismaClient.notificationLog;
  }
  get guardianNotificationEvent() {
    return (this.prismaClient as any).guardianNotificationEvent;
  }
  get guardianNotificationPreference() {
    return this.prismaClient.guardianNotificationPreference;
  }
  get guardianPushSubscription() {
    return this.prismaClient.guardianPushSubscription;
  }
  get guardianClientNotificationPreference() {
    return (this.prismaClient as any).guardianClientNotificationPreference;
  }
  get guardianClientPushSubscription() {
    return (this.prismaClient as any).guardianClientPushSubscription;
  }
  get paymentAttempt() {
    return (this.prismaClient as any).paymentAttempt;
  }
  get manualPaymentSubmission() {
    return (this.prismaClient as any).manualPaymentSubmission;
  }
  get collectApp() {
    return (this.prismaClient as any).collectApp;
  }
  get collectApiKey() {
    return (this.prismaClient as any).collectApiKey;
  }
  get collectWebhookDelivery() {
    return (this.prismaClient as any).collectWebhookDelivery;
  }
  get paymentGatewayAccount() {
    return (this.prismaClient as any).paymentGatewayAccount;
  }
  get clientWallet() {
    return (this.prismaClient as any).clientWallet;
  }
  get walletTransaction() {
    return (this.prismaClient as any).walletTransaction;
  }
  get clientBankAccount() {
    return (this.prismaClient as any).clientBankAccount;
  }
  get payoutRequest() {
    return (this.prismaClient as any).payoutRequest;
  }

  // NeuraChat Enterprise Collaboration Getters
  get chatConversation() {
    return (this.prismaClient as any).chatConversation;
  }
  get chatMember() {
    return (this.prismaClient as any).chatMember;
  }
  get chatMessage() {
    return (this.prismaClient as any).chatMessage;
  }
  get chatMessageReceipt() {
    return (this.prismaClient as any).chatMessageReceipt;
  }
  get chatMessageReaction() {
    return (this.prismaClient as any).chatMessageReaction;
  }
  get chatPinnedMessage() {
    return (this.prismaClient as any).chatPinnedMessage;
  }

  // For raw queries if needed
  get $queryRaw() {
    return this.prismaClient.$queryRaw.bind(this.prismaClient);
  }

  get $queryRawUnsafe() {
    return (this.prismaClient as any).$queryRawUnsafe.bind(this.prismaClient);
  }

  get $executeRaw() {
    return this.prismaClient.$executeRaw.bind(this.prismaClient);
  }

  get $executeRawUnsafe() {
    return (this.prismaClient as any).$executeRawUnsafe.bind(this.prismaClient);
  }

  get $transaction() {
    return this.prismaClient.$transaction.bind(this.prismaClient);
  }
}

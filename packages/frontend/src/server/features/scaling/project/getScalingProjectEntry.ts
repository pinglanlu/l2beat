import type {
  Project,
  ProjectCustomColors,
  ProjectScalingCategory,
  ProjectScalingStage,
  ReasonForBeingInOther,
  WarningWithSentiment,
} from '@l2beat/config'
import type { UnixTime } from '@l2beat/shared-pure'
import { ProjectId } from '@l2beat/shared-pure'
import compact from 'lodash/compact'
import type { ProjectLink } from '~/components/projects/links/types'
import type { BadgeWithParams } from '~/components/projects/ProjectBadge'
import type { ProjectDetailsSection } from '~/components/projects/sections/types'
import { env } from '~/env'
import { ps } from '~/server/projects'
import type { SsrHelpers } from '~/trpc/server'
import { getActivitySection } from '~/utils/project/activity/getActivitySection'
import { getContractsSection } from '~/utils/project/contracts-and-permissions/getContractsSection'
import { getContractUtils } from '~/utils/project/contracts-and-permissions/getContractUtils'
import { getPermissionsSection } from '~/utils/project/contracts-and-permissions/getPermissionsSection'
import { getCostsSection } from '~/utils/project/costs/getCostsSection'
import { getDataPostedSection } from '~/utils/project/data-posted/getDataPostedSection'
import { getBadgeWithParamsAndLink } from '~/utils/project/getBadgeWithParams'
import { getDiagramParams } from '~/utils/project/getDiagramParams'
import { getProjectLinks } from '~/utils/project/getProjectLinks'
import { getLivenessSection } from '~/utils/project/liveness/getLivenessSection'
import { getScalingRiskSummarySection } from '~/utils/project/risk-summary/getScalingRiskSummary'
import { getDataAvailabilitySection } from '~/utils/project/technology/getDataAvailabilitySection'
import { getOperatorSection } from '~/utils/project/technology/getOperatorSection'
import { getOtherConsiderationsSection } from '~/utils/project/technology/getOtherConsiderationsSection'
import { getSequencingSection } from '~/utils/project/technology/getSequencingSection'
import { getWithdrawalsSection } from '~/utils/project/technology/getWithdrawalsSection'
import { getStackedTvsSection } from '~/utils/project/tvs/getStackedTvsSection'
import {
  getUnderReviewStatus,
  type UnderReviewStatus,
} from '~/utils/project/underReview'
import { getProjectsChangeReport } from '../../projects-change-report/getProjectsChangeReport'
import { getIsProjectVerified } from '../../utils/getIsProjectVerified'
import { getProjectIcon } from '../../utils/getProjectIcon'
import { getActivityProjectStats } from '../activity/getActivityProjectStats'
import { getLiveness } from '../liveness/getLiveness'
import { get7dTvsBreakdown } from '../tvs/get7dTvsBreakdown'
import { getTokensForProject } from '../tvs/tokens/getTokensForProject'
import { getAssociatedTokenWarning } from '../tvs/utils/getAssociatedTokenWarning'
import { getScalingDaSolution } from './getScalingDaSolution'
import type { ScalingRosette } from './getScalingRosetteValues'
import { getScalingRosette } from './getScalingRosetteValues'

export interface ProjectScalingEntry {
  type: 'layer3' | 'layer2'
  name: string
  shortName: string | undefined
  slug: string
  icon: string
  archivedAt: UnixTime | undefined
  isUpcoming: boolean
  isAppchain: boolean
  colors:
    | {
        project: ProjectCustomColors | undefined
        ecosystem: ProjectCustomColors | undefined
      }
    | undefined
  underReviewStatus: UnderReviewStatus
  header: {
    warning?: string
    redWarning?: string
    emergencyWarning?: string
    ongoingAnomaly?: 'single' | 'multiple'
    description?: string
    badges?: BadgeWithParams[]
    links: ProjectLink[]
    hostChain?: string
    chainId?: number
    category: ProjectScalingCategory
    purposes: string[]
    tvs?: {
      breakdown?: {
        total: number
        native: number
        canonical: number
        external: number
        totalChange: number
      }
      warning?: WarningWithSentiment
      tokens: {
        breakdown?: {
          total: number
          ether: number
          stablecoin: number
          associated: number
        }
        warnings: WarningWithSentiment[]
        associatedTokens: string[]
      }
    }
    activity?: {
      lastDayUops: number
      uopsWeeklyChange: number
    }
    gasTokens?: string[]
  }
  rosette: ScalingRosette
  sections: ProjectDetailsSection[]
  reasonsForBeingOther?: ReasonForBeingInOther[]
  hostChainName: string
  stageConfig: ProjectScalingStage
  discoUiHref: string | undefined
}

export async function getScalingProjectEntry(
  project: Project<
    | 'display'
    | 'statuses'
    | 'scalingInfo'
    | 'scalingRisks'
    | 'scalingStage'
    | 'scalingTechnology'
    | 'tvsInfo',
    // optional
    | 'contracts'
    | 'tvsConfig'
    | 'permissions'
    | 'scalingDa'
    | 'customDa'
    | 'chainConfig'
    | 'isUpcoming'
    | 'archivedAt'
    | 'milestones'
    | 'trackedTxsConfig'
    | 'livenessConfig'
    | 'colors'
    | 'ecosystemColors'
    | 'discoveryInfo'
    | 'daTrackingConfig'
  >,
  helpers: SsrHelpers,
): Promise<ProjectScalingEntry> {
  const [
    projectsChangeReport,
    activityProjectStats,
    tvsStats,
    tokens,
    liveness,
    daSolution,
    contractUtils,
    stackedTvsSection,
    activitySection,
    costsSection,
    dataPostedSection,
  ] = await Promise.all([
    getProjectsChangeReport(),
    getActivityProjectStats(project.id),
    get7dTvsBreakdown({ type: 'projects', projectIds: [project.id] }),
    getTokensForProject(project),
    getLiveness(project.id),
    getScalingDaSolution(project),
    getContractUtils(),
    getStackedTvsSection(helpers, project),
    getActivitySection(helpers, project),
    project.scalingInfo.layer === 'layer2'
      ? getCostsSection(helpers, project)
      : undefined,
    project.scalingInfo.layer === 'layer2'
      ? getDataPostedSection(helpers, project)
      : undefined,
  ])

  const projectLiveness = liveness[project.id]

  const ongoingAnomalies = projectLiveness?.anomalies.filter(
    (a) => a.end === undefined,
  )

  const tvsProjectStats = tvsStats.projects[project.id]
  const header: ProjectScalingEntry['header'] = {
    description: project.display.description,
    warning: project.statuses.yellowWarning,
    redWarning: project.statuses.redWarning,
    emergencyWarning: project.statuses.emergencyWarning,
    ongoingAnomaly: ongoingAnomalies
      ? ongoingAnomalies.length === 0
        ? undefined
        : ongoingAnomalies.length === 1
          ? 'single'
          : 'multiple'
      : undefined,
    category: project.scalingInfo.type,
    purposes: project.scalingInfo.purposes,
    activity: activityProjectStats,
    links: getProjectLinks(project.display.links),
    hostChain:
      project.scalingInfo.hostChain.id !== ProjectId.ETHEREUM
        ? project.scalingInfo.hostChain.name
        : undefined,
    chainId: project.chainConfig?.chainId,
    tvs:
      !env.EXCLUDED_TVS_PROJECTS?.includes(project.id) && tvsProjectStats
        ? {
            breakdown: {
              ...tvsProjectStats.breakdown,
              totalChange: tvsProjectStats.change.total,
            },
            warning: project.tvsInfo.warnings[0],
            tokens: {
              breakdown: {
                ...tvsProjectStats.breakdown,
                associated: tvsProjectStats.associated.total,
              },
              warnings: compact([
                tvsProjectStats &&
                  tvsProjectStats.breakdown.total > 0 &&
                  getAssociatedTokenWarning({
                    associatedRatio:
                      tvsProjectStats.associated.total /
                      tvsProjectStats.breakdown.total,
                    name: project.name,
                    associatedTokens: project.tvsInfo.associatedTokens,
                  }),
              ]),
              associatedTokens: project.tvsInfo.associatedTokens,
            },
          }
        : undefined,
    badges: project.display.badges
      .map((badge) => getBadgeWithParamsAndLink(badge, project))
      .filter((b) => !!b),
    gasTokens: project.chainConfig?.gasTokens,
  }

  const changes = projectsChangeReport.getChanges(project.id)

  const common = {
    type: project.scalingInfo.layer,
    name: project.name,
    shortName: project.shortName,
    slug: project.slug,
    icon: getProjectIcon(project.slug),
    underReviewStatus: getUnderReviewStatus({
      isUnderReview: !!project.statuses.reviewStatus,
      ...changes,
    }),
    archivedAt: project.archivedAt,
    isUpcoming: !!project.isUpcoming,
    isAppchain: project.scalingInfo.capability === 'appchain',
    colors: env.CLIENT_SIDE_PARTNERS
      ? {
          project: project.colors,
          ecosystem: project.ecosystemColors,
        }
      : undefined,
    header,
    reasonsForBeingOther: project.scalingInfo.reasonsForBeingOther,
    rosette: getScalingRosette(project),
    hostChainName: project.scalingInfo.hostChain.name,
    stageConfig:
      project.scalingInfo.type === 'Other'
        ? { stage: 'NotApplicable' as const }
        : project.scalingStage,
    discoUiHref: project.discoveryInfo?.hasDiscoUi
      ? `https://disco.l2beat.com/ui/p/${project.id}`
      : undefined,
  }

  const sections: ProjectDetailsSection[] = []

  const sortedMilestones =
    project.milestones?.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    ) ?? []

  const hostChain =
    project.scalingInfo.hostChain.id !== ProjectId.ETHEREUM
      ? await ps.getProject({
          id: project.scalingInfo.hostChain.id,
          select: ['scalingTechnology', 'statuses'],
          optional: ['contracts'],
        })
      : undefined

  const isHostChainVerified = getIsProjectVerified(
    hostChain?.statuses.unverifiedContracts ?? [],
    projectsChangeReport.getChanges(hostChain?.id ?? ''),
  )
  const hostChainWarning = hostChain
    ? {
        hostChainName: hostChain.name,
        hostChainSlug: hostChain.slug,
        hostChainIcon: getProjectIcon(hostChain.slug),
      }
    : undefined
  const hostChainRisksSummary =
    hostChain && getScalingRiskSummarySection(hostChain, isHostChainVerified)
  const hostChainWarningWithRiskCount =
    hostChain && hostChainRisksSummary
      ? {
          hostChainName: hostChain.name,
          hostChainSlug: hostChain.slug,
          hostChainIcon: getProjectIcon(hostChain.slug),
          riskCount: hostChainRisksSummary.riskGroups.flatMap((rg) => rg.items)
            .length,
        }
      : undefined

  if (!project.isUpcoming && stackedTvsSection && tvsProjectStats) {
    sections.push({
      type: 'StackedTvsSection',
      props: {
        id: 'tvs',
        title: 'Value Secured',
        projectId: project.id,
        tvsBreakdownUrl: `/scaling/projects/${project.slug}/tvs-breakdown`,
        milestones: sortedMilestones,
        tokens,
        tvsProjectStats,
        tvsInfo: project.tvsInfo,
        ...stackedTvsSection,
      },
    })
  }

  if (activitySection) {
    sections.push({
      type: 'ActivitySection',
      props: {
        id: 'activity',
        title: 'Activity',
        projectId: project.id,
        milestones: sortedMilestones,
        category: project.scalingInfo.type,
        projectName: project.name,
        ...activitySection,
      },
    })
  }

  if (!project.isUpcoming && costsSection) {
    sections.push({
      type: 'CostsSection',
      props: {
        id: 'onchain-costs',
        title: 'Onchain costs',
        projectId: project.id,
        milestones: sortedMilestones,
        ...costsSection,
      },
    })
  }

  if (dataPostedSection) {
    sections.push({
      type: 'DataPostedSection',
      props: {
        id: 'data-posted',
        title: 'Data posted',
        projectId: project.id,
        milestones: sortedMilestones,
        ...dataPostedSection,
      },
    })
  }

  const livenessSection = await getLivenessSection(
    helpers,
    project,
    projectLiveness,
    projectsChangeReport.projects[project.id],
  )
  if (livenessSection) {
    sections.push({
      type: 'LivenessSection',
      props: {
        id: 'liveness',
        title: 'Liveness',
        projectId: project.id,
        milestones: sortedMilestones,
        ...livenessSection,
      },
    })
  }

  if (
    !project.isUpcoming &&
    project.milestones &&
    project.milestones.length > 0
  ) {
    sections.push({
      type: 'MilestonesAndIncidentsSection',
      props: {
        id: 'milestones-and-incidents',
        title: 'Milestones & Incidents',
        milestones: sortedMilestones,
      },
    })
  }

  if (project.scalingTechnology.detailedDescription) {
    sections.push({
      type: 'DetailedDescriptionSection',
      props: {
        id: 'detailed-description',
        title: 'Detailed description',
        description: project.display.description,
        detailedDescription: project.scalingTechnology.detailedDescription,
      },
    })
  }

  const isProjectVerified = getIsProjectVerified(
    project.statuses.unverifiedContracts ?? [],
    changes,
  )
  const riskSummary = getScalingRiskSummarySection(project, isProjectVerified)
  if (riskSummary.riskGroups.length > 0) {
    sections.push({
      type: 'RiskSummarySection',
      props: {
        ...riskSummary,
        id: 'risk-summary',
        title: 'Risk summary',
        hostChainWarning: hostChainWarningWithRiskCount,
        isUnderReview: !!project.statuses.reviewStatus,
      },
    })
  }

  if (project.isUpcoming) {
    sections.push({
      type: 'UpcomingDisclaimer',
      excludeFromNavigation: true,
    })
    return { ...common, sections }
  }

  if (hostChain && common.rosette.host) {
    sections.push({
      type: 'L3RiskAnalysisSection',
      props: {
        id: 'risk-analysis',
        title: 'Risk analysis',
        l2: {
          name: hostChain.name,
          risks: common.rosette.host,
        },
        l3: {
          name: project.name,
          risks: common.rosette.self,
        },
        combined: common.rosette.stacked,
        warning: project.scalingTechnology.warning,
        redWarning: project.statuses.redWarning,
        isVerified: isHostChainVerified,
        isUnderReview: !!project.statuses.reviewStatus,
      },
    })
  } else {
    sections.push({
      type: 'RiskAnalysisSection',
      props: {
        id: 'risk-analysis',
        title: 'Risk analysis',
        rosetteValues: common.rosette.self,
        warning: project.scalingTechnology.warning,
        redWarning: project.statuses.redWarning,
        isVerified: isProjectVerified,
        isUnderReview: !!project.statuses.reviewStatus,
      },
    })
  }

  if (project.scalingStage.stage !== 'NotApplicable') {
    sections.push({
      type: 'StageSection',
      props: {
        id: 'stage',
        title: 'Rollup stage',
        stageConfig: project.scalingStage,
        name: project.name,
        icon: getProjectIcon(project.slug),
        type: project.scalingInfo.type,
        isUnderReview: !!project.statuses.reviewStatus,
        isAppchain: project.scalingInfo.capability === 'appchain',
        additionalConsiderations:
          project.scalingStage.stage !== 'UnderReview'
            ? project.scalingStage.additionalConsiderations
            : undefined,
        scopeOfAssessment: project.scalingInfo.scopeOfAssessment,
        emergencyWarning: project.statuses.emergencyWarning,
      },
    })
  }

  const dataAvailabilitySection = getDataAvailabilitySection(
    project,
    daSolution,
  )
  if (dataAvailabilitySection) {
    sections.push({
      type: dataAvailabilitySection.type,
      props: {
        id: 'da-layer',
        title: 'Data availability',
        ...dataAvailabilitySection.props,
      },
    } as ProjectDetailsSection)
  }

  if (project.scalingTechnology.stateDerivation) {
    sections.push({
      type: 'StateDerivationSection',
      props: {
        id: 'state-derivation',
        title: 'State derivation',
        isUnderReview:
          !!project.statuses.reviewStatus ||
          !!project.scalingTechnology.stateDerivation.isUnderReview,
        ...project.scalingTechnology.stateDerivation,
      },
    })
  }

  if (project.scalingTechnology.stateValidation) {
    sections.push({
      type: 'StateValidationSection',
      props: {
        id: 'state-validation',
        title: 'State validation',
        stateValidation: project.scalingTechnology.stateValidation,
        diagram: getDiagramParams(
          'state-validation',
          project.scalingTechnology.stateValidationImage ?? project.slug,
        ),
        isUnderReview:
          !!project.statuses.reviewStatus ||
          !!project.scalingTechnology.stateValidation.isUnderReview,
      },
    })
  }

  const operatorSection = getOperatorSection(project)
  if (operatorSection) {
    sections.push({
      type: 'TechnologyChoicesSection',
      props: {
        id: 'operator',
        title: 'Operator',
        ...operatorSection,
        hostChainWarning,
      },
    })
  }

  const sequencingSection = getSequencingSection(project)
  if (sequencingSection) {
    sections.push({
      type: 'SequencingSection',
      props: {
        id: 'sequencing',
        title: 'Sequencing',
        ...sequencingSection,
      },
    })
  }

  const withdrawalsSection = getWithdrawalsSection(project)
  if (withdrawalsSection) {
    sections.push({
      type: 'TechnologyChoicesSection',
      props: {
        id: 'withdrawals',
        title: 'Withdrawals',
        ...withdrawalsSection,
        hostChainWarning,
      },
    })
  }

  const otherConsiderationsSection = getOtherConsiderationsSection(project)
  if (otherConsiderationsSection) {
    sections.push({
      type: 'TechnologyChoicesSection',
      props: {
        id: 'other-considerations',
        title: 'Other considerations',
        ...otherConsiderationsSection,
      },
    })
  }
  if (project.scalingTechnology.upgradesAndGovernance) {
    sections.push({
      type: 'MarkdownSection',
      props: {
        id: 'upgrades-and-governance',
        title: 'Upgrades & Governance',
        content: project.scalingTechnology.upgradesAndGovernance,
        diagram: getDiagramParams(
          'upgrades-and-governance',
          project.scalingTechnology.upgradesAndGovernanceImage ?? project.slug,
        ),
        isUnderReview: !!project.statuses.reviewStatus,
      },
    })
  }

  const permissionsSection = getPermissionsSection(
    {
      id: project.id,
      hostChain: hostChain?.id,
      isUnderReview: !!project.statuses.reviewStatus,
      permissions: project.permissions,
    },
    contractUtils,
    projectsChangeReport,
  )
  if (permissionsSection) {
    const permissionedEntities = project.customDa?.dac?.knownMembers

    sections.push({
      type: 'PermissionsSection',
      props: {
        ...permissionsSection,
        id: 'permissions',
        title: 'Permissions',
        permissionedEntities,
        discoUiHref: common.discoUiHref,
      },
    })
  }

  const contractsSection = getContractsSection(
    {
      id: project.id,
      isVerified: isProjectVerified,
      slug: project.slug,
      contracts: project.contracts,
      isUnderReview: !!project.statuses.reviewStatus,
      architectureImage: project.scalingTechnology.architectureImage,
    },
    contractUtils,
    projectsChangeReport,
  )
  if (contractsSection) {
    sections.push({
      type: 'ContractsSection',
      props: {
        ...contractsSection,
        id: 'contracts',
        title: 'Smart contracts',
        discoUiHref: common.discoUiHref,
      },
    })
  }

  return { ...common, sections }
}

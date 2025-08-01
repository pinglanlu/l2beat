import { ProjectId, UnixTime } from '@l2beat/shared-pure'
import {
  DaCommitteeSecurityRisk,
  DaRelayerFailureRisk,
  DaUpgradeabilityRisk,
} from '../../common'
import { linkByDA } from '../../common/linkByDA'
import { ProjectDiscovery } from '../../discovery/ProjectDiscovery'
import {
  generateDiscoveryDrivenContracts,
  generateDiscoveryDrivenPermissions,
} from '../../templates/generateDiscoveryDrivenSections'
import { getDiscoveryInfo } from '../../templates/getDiscoveryInfo'
import type { BaseProject } from '../../types'

const ethereumDiscovery = new ProjectDiscovery('blobstream')
const arbitrumDiscovery = new ProjectDiscovery('blobstream', 'arbitrum')
const baseDiscovery = new ProjectDiscovery('blobstream', 'base')

export const blobstream: BaseProject = {
  id: ProjectId('blobstream'),
  slug: 'blobstream',
  name: 'Blobstream',
  shortName: undefined,
  addedAt: UnixTime(1729253328), // 2024-10-18T12:08:48Z
  // data
  statuses: {
    yellowWarning: undefined,
    redWarning: undefined,
    emergencyWarning: undefined,
    reviewStatus: undefined,
    unverifiedContracts: [],
  },
  display: {
    description:
      'The Blobstream bridge serves as a ZK light client, enabling the bridging of data availability commitments between Celestia and destination chains.',
    links: {
      documentation: [
        'https://docs.celestia.org/developers/blobstream',
        'https://hackmd.io/@succinctlabs/HJE7XRrup',
      ],
      repositories: [
        'https://github.com/succinctlabs/sp1-blobstream',
        'https://github.com/succinctlabs/blobstreamx',
      ],
    },
    badges: [],
  },
  daBridge: {
    name: 'Blobstream',
    daLayer: ProjectId('celestia'),
    usedIn: linkByDA({
      layer: ProjectId('celestia'),
      bridge: ProjectId('blobstream'),
    }),
    technology: {
      description: `
      ## Architecture
        
      ![Celestia blobstream architecture](/images/da-bridge-technology/celestia/blobstream/architecture.png#center)
      
       The Blobstream bridge is a data availability bridge that facilitates data availability commitments to be bridged between Celestia and Ethereum.
       The Blobstream bridge is composed of three main components: the **Blobstream** contract, the **Succinct Gateway** contracts, and the **Verifier** contracts.  <br /> 
       By default, Blobstream operates asynchronously, handling requests in a fulfillment-based manner. First, zero-knowledge proofs of Celestia block ranges are requested for proving. Requests can be submitted either off-chain through the Succinct API, or onchain through the requestCall() method of the Succinct Gateway smart contract.
       Alternatively, it is possible to run an SP1 Blobstream operator with local proving, allowing for self-generating the proofs.
       Once a proving request is received, the off-chain prover generates the proof and relays it to Blobstream contract. The Blobstream contract verifies the proof with the corresponding verifier contract and, if successful, stores the data commitment in storage. <br /> 
  
       Verifying a header range includes verifying tendermint consensus (header signatures are 2/3 of stake) and verifying the data commitment root.
        By default, Blobstream is updated by the Succinct operator at a regular cadence of 1 hour. Note that the update interval can vary across chains.
      `,
      references: [
        {
          title: 'SP1 Blobstream Operator',
          url: 'https://github.com/succinctlabs/sp1-blobstream/blob/b35c92bfcfc9a1711ea014cc871d6dd610dd5392/script/bin/operator.rs',
        },
        {
          title: 'Succinct Gateway - Etherscan',
          url: 'https://etherscan.io/address/0x6c7a05e0AE641c6559fD76ac56641778B6eCd776#code#F1#L148',
        },
      ],
      risks: [
        {
          category: 'Funds can be lost if',
          text: 'the DA bridge accepts an incorrect or malicious data commitment provided by 2/3 of Celestia validators.',
        },
        {
          category: 'Funds can be frozen if',
          text: 'excluding L2-specific DA fallback - the permissioned relayers are unable to submit DA commitments to the Blobstream contract.',
        },
      ],
    },
    risks: {
      committeeSecurity:
        DaCommitteeSecurityRisk.RobustAndDiverseCommittee('Validator set'),
      upgradeability: DaUpgradeabilityRisk.LowOrNoDelay(0), // TIMELOCK_ROLE is 4/6 multisig
      relayerFailure: DaRelayerFailureRisk.NoMechanism,
    },
  },
  contracts: {
    addresses: generateDiscoveryDrivenContracts([
      ethereumDiscovery,
      arbitrumDiscovery,
      baseDiscovery,
    ]),
    risks: [
      {
        category: 'Funds can be lost if',
        text: 'the bridge contract or its dependencies receive a malicious code upgrade. There is no delay on code upgrades.',
      },
      {
        category: 'Funds can be frozen if',
        text: 'the bridge contract is frozen by the Guardian (BlobstreamMultisig).',
      },
    ],
  },
  milestones: [
    {
      title: 'Plonky3 vulnerability patch',
      url: 'https://x.com/SuccinctLabs/status/1929773028034204121',
      date: '2025-06-04T00:00:00.00Z',
      description:
        'SP1 verifier is patched to fix critical vulnerability in Plonky3 proof system (SP1 dependency).',
      type: 'incident',
    },
  ],
  permissions: generateDiscoveryDrivenPermissions([
    ethereumDiscovery,
    arbitrumDiscovery,
    baseDiscovery,
  ]),
  discoveryInfo: getDiscoveryInfo([
    ethereumDiscovery,
    arbitrumDiscovery,
    baseDiscovery,
  ]),
}

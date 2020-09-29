import React from 'react';
import { RouteComponentProps, withRouter, Link } from 'react-router-dom';
import { observer } from 'mobx-react';
import { BlockContainer } from '../containers/BlockContainer';
import DataTable from './DataTable';
import { BlockInfo } from 'casperlabs-grpc/io/casperlabs/casper/consensus/info_pb';
import Pages from './Pages';
import {
  RefreshableComponent,
  Icon,
  SuccessIcon,
  FailIcon,
  CSPR
} from './Utils';
import { Block } from 'casperlabs-grpc/io/casperlabs/casper/consensus/consensus_pb';
import { shortHash } from './Utils';
import ObservableValueMap, { ObservableValue } from '../lib/ObservableValueMap';
import { GetDeployResult, JsonBlock } from '../rpc/CasperServiceByJsonRPC';

// https://www.pluralsight.com/guides/react-router-typescript

// URL parameter
type Params = {
  blockHashBase16: string;
};

interface Props extends RouteComponentProps<Params> {
  block: BlockContainer;
}

@observer
class _BlockDetails extends RefreshableComponent<Props, {}> {
  constructor(props: Props) {
    super(props);
    this.props.block.init(this.blockHashBase16);
  }

  get blockHashBase16() {
    return this.props.match.params.blockHashBase16;
  }

  get container() {
    return this.props.block;
  }

  async refresh() {
    await this.container.loadBlock();
    await this.container.loadDeploys();
    await this.container.loadBalances();
  }

  componentDidUpdate() {
    // Container and component stays the same during navigation.
    if (this.blockHashBase16 !== this.container.blockHashBase16) {
      this.container.init(this.blockHashBase16);
      this.refresh();
    }
  }

  render() {
    return (
      <div>
        <BlockTable
          blockHashBase16={this.blockHashBase16}
          block={this.container.block}
          refresh={() => this.container.loadBlock()}
        />
        <DeploysTable
          blockHashBase16={this.blockHashBase16}
          deploys={this.container.deploys}
          balances={this.container.balances}
        />
      </div>
    );
  }
}

// Inject the router parameters so we can extract the ID from the URL.
export const BlockDetails = withRouter(_BlockDetails);

const BlockTable = observer(
  (props: {
    blockHashBase16: string;
    block: JsonBlock | null;
    refresh: () => void;
  }) => {
    const attrs = props.block && blockAttrs(props.block);
    return (
      <DataTable
        title={`Block ${props.blockHashBase16}`}
        headers={[]}
        rows={attrs}
        renderRow={(attr, i) => (
          <tr key={i}>
            <th>{attr[0]}</th>
            <td>{attr[1]}</td>
          </tr>
        )}
        refresh={() => props.refresh()}
      />
    );
  }
);

const DeploysTable = observer(
  (props: {
    blockHashBase16: string;
    deploys: GetDeployResult[] | null;
    balances: ObservableValueMap<string, number>;
  }) => {
    return (
      <DataTable
        title={`Deploys in block ${props.blockHashBase16}`}
        headers={[
          'Deploy Hash',
          'Account',
          'Gas Price',
          'Cost',
          'Remaining Balance',
          'Message'
        ]}
        rows={props.deploys}
        renderRow={(deploy, i) => {
          const id = deploy.deploy.hash;
          const accountId = deploy.deploy.header.account;
          return (
            <tr key={i}>
              <td>
                <Link to={Pages.deploy(id)}>{shortHash(id)}</Link>
              </td>
              <td>{shortHash(accountId)}</td>
              <td className="text-right">
                <CSPR motes={deploy.deploy.header.gas_price} />
              </td>
              <td className="text-right">
                <CSPR motes={deploy.execution_results[0].result.cost} />
              </td>
              <td className="text-right">
                <Balance balance={props.balances.get(accountId)} />
              </td>
              <td className="text-center">
                {deploy.execution_results[0].result.error_message ? (
                  <FailIcon />
                ) : (
                  <SuccessIcon />
                )}
              </td>
              <td>{deploy.execution_results[0].result.error_message}</td>
            </tr>
          );
        }}
      />
    );
  }
);

const blockAttrs: (block: JsonBlock) => Array<[string, any]> = (
  block: JsonBlock
) => {
  const id = block.hash;
  const header = block.header;
  const proposer = header.proposer;
  return [
    ['Block Hash', id],
    ['Height', header.height],
    ['Era ID', header.era_id],
    ['Timestamp', new Date(header.timestamp).toISOString()],
    ['Proposer', proposer],
    ['Deploy Count', header.deploy_hashes.length],
    ['Parent Hash', <BlockLink blockHashBase16={header.parent_hash} />]
  ];
};

export const BlockLink = (props: { blockHashBase16: string }) => {
  return (
    <Link to={Pages.block(props.blockHashBase16)}>{props.blockHashBase16}</Link>
  );
};

// Need to observe the balance to react to when it's available.
export const Balance = observer(
  (props: { balance: ObservableValue<number> }) => {
    const value = props.balance.value;
    if (value == null) return null;
    return <CSPR motes={value} />;
  }
);

export const BlockType = (props: { header: Block.Header }) => {
  let typ = props.header.getMessageType();
  let lbl =
    typ === Block.MessageType.BLOCK
      ? 'Block'
      : typ === Block.MessageType.BALLOT
      ? 'Ballot'
      : 'n/a';
  return <span>{lbl}</span>;
};

export const BlockRole = (props: { header: Block.Header }) => {
  let role = props.header.getMessageRole();
  let lbl =
    role === Block.MessageRole.PROPOSAL
      ? 'Proposal'
      : role === Block.MessageRole.CONFIRMATION
      ? 'Confirmation'
      : role === Block.MessageRole.WITNESS
      ? 'Witness'
      : 'n/a';
  return <span>{lbl}</span>;
};

export const FinalityIcon = (props: { block: BlockInfo }) => {
  if (
    props.block
      .getSummary()
      ?.getHeader()!
      .getMessageType() === Block.MessageType.BALLOT
  )
    return null;

  let finality = props.block.getStatus()!.getFinality();
  if (finality === BlockInfo.Status.Finality.FINALIZED) {
    return <SuccessIcon />;
  } else if (finality === BlockInfo.Status.Finality.ORPHANED)
    return <FailIcon />;
  else {
    return <Icon name="clock" />;
  }
};

export default BlockDetails;

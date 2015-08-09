const React = require('react');
const DefaultLayout = require('./layouts/DefaultLayout');

const moment = require('moment');

const BranchTableRow = React.createClass({

  renderLatestCommit: function() {
    const {branch} = this.props;
    const commit = branch.latest.commit;
    const performance = branch.latest.performance || [];
    const duration = performance.reduce((total, item) => total + item.time/1000, 0);

    return [
      <td key="commit-message">
        <a href={commit.html_url}>
          <code>{commit.sha.substr(0, 5)}</code>
          {' '}
          {commit.message.length < 30 ? commit.message : commit.message.substr(0, 30) + '...'}
        </a>
      </td>,

      <td key="commmit-duration">
        {duration.toFixed(2) + ' seconds'}
      </td>,

      <td key="commit-timestamp">
        {branch.latest.timestamp && moment.unix(branch.latest.timestamp).fromNow()}
      </td>
    ];
  },

  renderNoLatestCommit: function() {
    return <td colspan="2">None yet</td>;
  },

  renderBranchLock: function() {
    const {isVouched, branch} = this.props;

    if (branch.lock) {
      return (
        <td> 
          <span className="label label-default">{branch.lockStatus}</span>
          {' '}
          {isVouched && (
            <form method="post" action={'/branch/' + branch.branchId + '/unlock'}>
              <input className="btn btn-default btn-xs" type="submit" value="Unlock"/>
            </form>
          )}
        </td>
      );
    } else {
      return isVouched && (
        <td>
          <form method="post" action={'/branch/' + branch.branchId + '/ship'}>
            <input className="btn btn-default btn-primary btn-xs" type="submit" value="Ship"/>
          </form>
        </td>
      );
    }
  },

  render: function() {
    const {isBase, branch} = this.props;

    return (
      <tr className={isBase ? 'info' : ''}>
        <td>
          {branch.branchId}
          {' '}
          {isBase && (
            <span className="label label-default label-primary">Base</span>
          )}
        </td>

        {(branch.latest && branch.latest.commit) ? 
          this.renderLatestCommit() : 
          this.renderNoLatestCommit()}

        {this.renderBranchLock()}
      </tr>
    );
  }

});

const IndexPage = React.createClass({

  render: function() {
    return (
      <DefaultLayout {...this.props}>
        <div className="container with-fixed-header">
          <table className="table">
            <thead>
              <tr>
                <th>Branch</th>
                <th colSpan={4}>Last Shipment</th>
              </tr>
            </thead>
            <tbody>
              <BranchTableRow isVouched={this.props.isVouched} branch={this.props.base} key="base" isBase={true}/>
              {this.props.recent.map((branch) => (
                (branch.branchId !== this.props.base.branchId) &&
                <BranchTableRow isVouched={this.props.isVouched} branch={branch} key={branch.branchId}/>
              ))}
            </tbody>
          </table>
        </div>
      </DefaultLayout>
    );
  }

});

module.exports = IndexPage;

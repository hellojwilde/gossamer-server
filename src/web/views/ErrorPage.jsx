const React = require('react');
const DefaultLayout = require('./layouts/DefaultLayout');

const ErrorPage = React.createClass({

  render: function() {
    return (
      <DefaultLayout {...this.props}>
        <div className="container with-fixed-header">
          <h1>{this.props.message}</h1>
          <h2>{this.props.error.status}</h2>
          <pre>{this.props.error.stack}</pre>
        </div>
      </DefaultLayout>
    );
  }

});

module.exports = ErrorPage;
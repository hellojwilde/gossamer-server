const React = require('react');
const ModalLayout = require('./layouts/ModalLayout');

const LoginPage = React.createClass({

  render: function() {
    return (
      <ModalLayout {...this.props}>
        <div className="panel-body">
          <div className="alert alert-info" role="alert">
            Looks like you need to log in to see this.
            Don't worry, we'll get you going in a jiffy.
          </div>

          <a className="btn btn-default btn-lg btn-primary btn-block" href={this.props.url}>
            Log in with GitHub
          </a>
        </div>
      </ModalLayout>
    );
  }

});

module.exports = LoginPage;
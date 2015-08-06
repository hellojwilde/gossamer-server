const React = require('react');
const ModalLayout = require('./layouts/ModalLayout');

const IndexLoginPage = React.createClass({

  render: function() {
    return (
      <ModalLayout {...this.props}>
          <h2>
            Gossamer
          </h2>
          <p className="lead">
            An experimental branch of <a href="https://github.com/mozilla/browser.html">browser.html</a>,
            focusing on collaborative development.
          </p>
          <p>
            If you're a <a href="https://mozillians.org/en-US/">vouched Mozillian</a>, 
            you can fork <a href="https://github.com/hellojwilde/gossamer">the browser on GitHub</a>{' '}
            and make experimental changes.
          </p>
          <p>
            Others can try your branch and receive updates.
          </p>
          <p>
            In many cases, switching branches and applying updates is restartless, without any extra work on your part.
          </p>
          <hr/>
          <p>
            <a href="#" className="btn btn-lg btn-primary btn-defau;t btn-block">
              Download Gossamer for OS X
            </a>
          </p>
      </ModalLayout>
    );
  }

});

module.exports = IndexLoginPage;
const React = require('react');
const ModalLayout = require('./layouts/ModalLayout');

const IndexLoginPage = React.createClass({

  render: function() {
    return (
      <ModalLayout {...this.props}>
        <h1>
          An experimental browser
          focusing on collaborative development.
        </h1>

        <p>
        <div className="embed-responsive embed-responsive-16by9">
          <iframe 
            className="embed-responsive-item"
            src="https://www.youtube.com/embed/faWPkOBiWJA?controls=0&showinfo=0&rel=0" 
            frameBorder={0} 
            allowfullscreen>
          </iframe>
        </div>
        </p>

        <p className="lead">
          If you're a <a href="https://mozillians.org/en-US/">vouched Mozillian</a>, 
          you can fork <a href="https://github.com/hellojwilde/gossamer">the browser on GitHub</a>{' '}
          and make experimental changes. Users can try your branch and receive 
          updates, <em>usually without a restart or reload</em>.
        </p>
        <p>
          <a href="#" className="disabled btn btn-lg btn-primary btn-defau;t btn-block">
            Download Gossamer for OS X
          </a>
          <small>We'll have the download link up shortly!</small>
        </p>
      </ModalLayout>
    );
  }

});

module.exports = IndexLoginPage;
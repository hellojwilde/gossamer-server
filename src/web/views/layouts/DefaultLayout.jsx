const React = require('react');

const NavbarUserMenu = React.createClass({

  render: function() {
    return (
      <ul className="nav navbar-nav navbar-right">
        <li>
          <a className="navbar-user" href={this.props.profile.profileUrl}>
            <img 
              className="navbar-user-avatar img-circle"
              src={this.props.profile._json.avatar_url}
            />
            <span className="navbar-user-name">
              {this.props.profile.displayName}
            </span>
            {this.props.isVouched && (
              <span className="navbar-user-voucher">
                <span
                  className="glyphicon glyphicon-ok-sign"
                  data-toggle="tooltip"
                  data-placement="bottom"
                  title="Verified Mozillian"
                />
              </span>
            )}
          </a>
        </li>
        <li>
          <a href="/user/logout">
            Log out
          </a>
        </li>
      </ul>
    );
  }

});

const NavbarAnonymousUserMenu = React.createClass({

  render: function() {
    return (
      <a className="btn btn-default navbar-btn navbar-right" href="/user/oauth">
        Log in with GitHub
      </a>
    );
  }

});

const DefaultLayout = React.createClass({

  render: function() {
    return (
      <html lang="en">
        <head>
          <title>{this.props.title}</title>
          <meta charSet="utf-8"/>

          <link rel="stylesheet" href="https://code.ionicframework.com/ionicons/2.0.1/css/ionicons.min.css"/>
          <link rel="stylesheet" href="/stylesheets/bootstrap.css"/>
          <link rel="stylesheet" href="/stylesheets/style.css"/>
        </head>

        <body>
          <nav className="navbar navbar=default navbar-fixed-top">
            <div className="container">
              <div className="navbar-header">
                <button 
                  className="navbar-toggle collapsed"
                  type="button"
                  data-toggle="collapse"
                  data-target="#navbar-collapse">
                  <span className="sr-only">Toggle navigation</span>
                  <span className="icon-bar"/>
                  <span className="icon-bar"/>
                  <span className="icon-bar"/>
                </button>
                <a href="/" className="navbar-brand">
                  <span className="ion-erlenmeyer-flask"/> Gossamer
                </a>
              </div>

              <div className="navbar-collapse collapse" id="navbar-collapse">
                {this.props.isAuthenticated ? 
                  <NavbarUserMenu {...this.props.user}/> : 
                  <NavbarAnonymousUserMenu/>}
              </div>
            </div>
          </nav>

          {this.props.children}
        </body>
      </html>
    );
  }

});

module.exports = DefaultLayout;
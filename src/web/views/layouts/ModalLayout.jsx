const React = require('react');
const DefaultLayout = require('./DefaultLayout');

const ModalLayout = React.createClass({

  render: function() {
    const {children, ...props} = this.props;

    return (
      <DefaultLayout {...props}>
        <div className="full-page">
          <div className="vertical-center">
            <div className="vertical-center-inner">
              <div className="container">
                <div className="row">
                  <div className="col-sm-6 col-sm-offset-3">
                    {children}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DefaultLayout>
    );
  }

});

module.exports = ModalLayout;
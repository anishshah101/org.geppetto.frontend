
define(function (require) {
    var React = require('react'),
        $ = require('jquery');

    return function () {
        var handlerProps =
            ['handleShow', 'handleShown', 'handleHide', 'handleHidden']

        var bsModalEvents = {
            handleShow: 'show.bs.modal', handleShown: 'shown.bs.modal', handleHide: 'hide.bs.modal', handleHidden: 'hidden.bs.modal'
        }

        return {
            propTypes: {
                handleShow: React.PropTypes.func, handleShown: React.PropTypes.func, handleHide: React.PropTypes.func, handleHidden: React.PropTypes.func, backdrop: React.PropTypes.bool, keyboard: React.PropTypes.bool, show: React.PropTypes.bool, remote: React.PropTypes.string
            }, 
            getDefaultProps: function () {
                return {
                    backdrop: true, 
                    keyboard: true, 
                    show: false, 
                    remote: '', 
                    handleHidden: (function(){ 
                        React.unmountComponentAtNode($(this.getDOMNode()).parent().get(0))}).bind(this)
                }
            },
            //Close modal if one is currently open
            componentWillMount: function() {
                if($('.modal')) {
                    $('.modal').modal('hide');
                }
            },
            
            componentDidMount: function () {
                var $modal = $(this.getDOMNode()).modal({
                    backdrop: this.props.backdrop, keyboard: this.props.keyboard, show: this.props.show, remote: this.props.remote
                })
                handlerProps.forEach(function (prop) {
                    if (this[prop]) {
                        $modal.on(bsModalEvents[prop], this[prop])
                    }
                    if (this.props[prop]) {
                        $modal.on(bsModalEvents[prop], this.props[prop])
                    }
                }.bind(this));
      
            }, 
            componentWillUnmount: function () {
                var $modal = $(this.getDOMNode())
                handlerProps.forEach(function (prop) {
                    if (this[prop]) {
                        $modal.off(bsModalEvents[prop], this[prop])
                    }
                    if (this.props[prop]) {
                        $modal.off(bsModalEvents[prop], this.props[prop])
                    }
                }.bind(this))
                
                $modal.modal('hide');
            }, 
            hide: function () {
                $(this.getDOMNode()).modal('hide');
            }, 
            show: function () {
                $(this.getDOMNode()).modal('show');
            }, 
            toggle: function () {
                $(this.getDOMNode()).modal('toggle');
            }, 
            renderCloseButton: function () {
                return <button
                type="button"
                className="close"
                onClick={this.hide}
                dangerouslySetInnerHTML={{__html: '&times'}}
                />
            }
        }
    }();
});
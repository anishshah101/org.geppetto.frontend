define(function(require) {

    var React = require('react');
    var GEPPETTO = require('geppetto');

    var Controls = React.createClass({

        mixins:[require('mixins/TutorialMixin')],

        popoverTitle: 'Widget Controls',

        popoverText: 'Use these controls to add or remove a widget.',

        popoverTemplate: '<div class="popover" role="tooltip"><div class="arrow"></div><h3 class="popover-title"></h3><div class="popover-content"></div><button class="btn btn-info tutorial-next"><i class="icon-check"></i></button></div>',

        w1: function() {
            GEPPETTO.Console.executeCommand('G.addWidget(0)');
        },

	   w2: function() {
            GEPPETTO.Console.executeCommand('G.addWidget(1)');
        },
        
        w3: function() {
            GEPPETTO.Console.executeCommand('G.addWidget(2)');
        },
        
        w4: function() {
            GEPPETTO.Console.executeCommand('G.addWidget(3)');
        },
        
        w5: function() {
            GEPPETTO.Console.executeCommand('G.addWidget(4)');
        },
        
        w6: function() {
            GEPPETTO.Console.executeCommand('G.addWidget(5)');
        },
        	 
        componentDidMount: function() {
            GEPPETTO.on('start:tutorial', (function() {               
                GEPPETTO.once('tutorial:widgetcontrols', (function(){
                    if(GEPPETTO.tutorialEnabled) {
                        this.showPopover;
                    }
                }).bind(this)); 

                $('.tutorial-next').click(function(){
                    this.destroyPopover;
                    GEPPETTO.trigger('tutorial:console');
                }.bind(this));
            }).bind(this));
        },

        render: function () {
            return (
            	<div className="widgetcontrols">
                    <button className="btn squareB w1" onClick={this.w1}>1</button>
                    <button className="btn squareB w1" onClick={this.w2}>2</button>
                    <button className="btn squareB w1" onClick={this.w3}>3</button>
                    <button className="btn squareB w1" onClick={this.w4}>4</button>
                    <button className="btn squareB w1" onClick={this.w5}>5</button>
                    <button className="btn squareB w1" onClick={this.w6}>6</button>

                </div>

            );
        }

    });

    React.renderComponent(Controls({},''), document.getElementById('widget-toolbar'));

});

/*
 * Froala-Reactive
 * ===============
 *
 * (c) 2014 RSBA Technology Ltd
 * 
 *  Wraps Froala Editor jQuery plugin into a reactive Meteor template object
 *
 * Implementation heavily based on 'x-editable-reactive-template' Meteor package
 * see: https://github.com/davidworkman9/x-editable-reactive-template
 *
 * Example Usage:
 *
 * {{> froalaEditable inlineMode=true initOnClick=false autosave=true 
 *     autosaveInterval=2000 _onbeforeSave=onSaved 
 *     _value=requirementParameter.text}}
 *
 * Set Froala Editor options as <option>=<value>
 * (see: https://editor.froala.com/options)
 * This template will dynamically call option setter methods if any of the
 * providfed option parameter values change, reactively.
 *
 * Register callbacks for Froala Editor events by prefixing the event name
 * by '_on'.  Callbacks get the same two parameters: e, editor provided by
 * Froala Editor's event callbacks.  The data context on the callbacks is set
 * from the data context of the froalaEditable template instance.
 *
 * onSaved: function () {
 *   var self = this;
 *   return function (e, editor) {
 *     // Do something
 *   };
 * }
 *
 * Pass the model value to be wrapped by the editor in the '_value' argument
 *
 */
 
'use strict';

Template.froalaReactive.rendered = function () {
  var tmpl = this,
    lastData = tmpl.data,
    $input = tmpl.$('.froala-reactive-meteorized'),
    froalaMethod;

  if ($input.length !== 1) {
    throw new Error ('invalid-froala-reactive-template');
  }

  froalaMethod = getFroalaEditableJQueryInstanceMethod($input);
  if (!froalaMethod) {
    throw new Error('invalid-froala-editor-plugin');
  }

  // Create Froala Editor instance, setting options & initial HTML content
  // from template data context
  $input[froalaMethod](tmpl.data);
  if (tmpl.data._value) {
    $input[froalaMethod]('setHTML', tmpl.data._value);
  }

  // Set up additional event handlers
  var eventHandlers = getEventHandlerNames(tmpl.data);
  _.each(eventHandlers, function (opt) {
    var _eventName = 'editable.' + opt.substring(3); // Remove '_on' prefix
    $input.on(_eventName, function (e) {
      e.preventDefault();
      // Call callback, setting `this` to the latest, reactive, data context
      // of this template instance.
      // Callback function can use `this._value` to get up-to-date model value.
      // Also note that these callbacks fire AFTER the autorun function below
      // has triggered if the data context changed. Hence, we pass the `lastData`
      // property as the data context for the callback function, not the original
      // `tmpl.data` object.
      tmpl.data[opt].apply(lastData, arguments);
    });
  });

  // Autorun block, re-run every time the data context changes
  tmpl.autorun(function () {
    var self = this;

    // Set up reactive dependency on template's data context
    var _data = Template.currentData();

    // Update HTML data wrapped within froala editor, if changed
    if (_data._value && !_.isEqual(lastData._value, _data._value)) {
      $input[froalaMethod]('setHTML', _data._value);
      // Restore current selection from markers, if present
      $input[froalaMethod]('restoreSelectionByMarkers');

    }

    // Update froala editor option values, if changed
    var changedOpts = _.filter(Object.keys(_data), function (opt) {
        // Find all option values whose value has changed
        // Exclude any opt properties that start with '_', reserved for 
        // passing froala-reactive - specific parameters into the template 
        // data context.
        return opt.indexOf('_')!==0 && !_.isEqual(lastData[opt], _data[opt]);
    });
    _.each(changedOpts, function (opt) {
      $input[froalaMethod]('option', opt, _data[opt]);
    });
    // Save current data context for comparison on next autorun execution
    lastData = _data;
   });

  

};

/**
 * Ensure froalaEditor is properly removed to prevent memory leaks
 */
Template.froalaReactive.destroyed = function () {
 var tmpl = this,
    $input = tmpl.$('.froala-reactive-meteorized'),
    froalaMethod;

  froalaMethod = getFroalaEditableJQueryInstanceMethod($input);
  if (!froalaMethod) {
    return;
  }
  // Destroy event handlers
  var eventHandlers = getEventHandlerNames(tmpl.data);
  _.each(eventHandlers, function (opt) {
    var _eventName = 'editable.' + opt.substring(3); // Remove '_on' prefix
    $input.unbind(_eventName);
  });
  // Destroy froala editor object itself
  // This may throw an exception if Meteor has already torn down part of the DOM
  // managed by Froala Editor, so we wrap this in a try / catch block to
  // silently ignore any such cases
  try {
    $input[froalaMethod]('destroy');
  } catch (err) {}
};

/**
 * Internal function to return correct Froala Editable instance method name
 *
 * If you want to use both FroalaEditable and XEditable jQuery plugin packages
 * in your application, both of them set a 'editable' instance method on the 
 * jQuery prototype.  So, you have to rename 'editable' for one of these two 
 * plugins, after loading script for one plugin, but before the second:
 *
 * ... load Froala Editable package ...
 * 
 * // Rename Froala's 'editable' property to 'froalaEditable'
 * $.fn.froalaEditable = $.fn.editable;
 * delete $.fn.editable;
 * 
 * ... load XEditable package
 * 
 */
function getFroalaEditableJQueryInstanceMethod(froalaJQueryObject) {
  if (froalaJQueryObject) {
    if (_.isFunction(froalaJQueryObject.froalaEditable)) {
      // Overidden froala editable jQuery instance method
      return 'froalaEditable';
    } else if (_.isFunction(froalaJQueryObject.editable)) {
      // Original froala editable jQuery instance method
      return 'editable';
    }    
  }
  // Whoops! Looks like froala editor code has not been loaded
  return null;
};

/**
 * Internal function to parse any '_on<event>' event callback arguments
 */
function getEventHandlerNames(tmplData) {
 return _.filter(Object.keys(tmplData), function (opt) {
    return opt.indexOf('_on') === 0 && // Include if '_on...'
      _.isFunction(tmplData[opt]); // and handler is indeed a function
  });
}

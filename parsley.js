/*
 * Parsley.js allows you to verify your form inputs frontend side, without writing a line of javascript. Or so..
 *
 * Author: Guillaume Potier - @guillaumepotier
*/

!function ($) {

  'use strict';

  var PCrispum = {

    messages: {
      defaultMessage: "This value seems to be invalid."
      , type: {
        alphanum:    "This value should be alphanumeric."
        , dateIso:   "This value should be a valid date (YYYY-MM-DD)."
        , digits:    "This value should be digits."
        , email:     "This value should be a valid email."
        , number:    "This value should be a valid number."
        , phone:     "This value should be a valid phone number."
        , url:       "This value should be a valid url."
        , urlstrict: "This value should be a valid url."
      }
      , required:    "This value is required."
      , regexp:      "This value seems to be invalid."
      , min:         "This value should be greater than or equal to {min}."
      , max:         "This value should be lower than or equal to {max}."
      , mincheck:    "You must select at least {min} choices."
      , maxcheck:    "You must select {max} choices or less."
    }

    /**
     * A collection of 'field' finders.
     *
     * Given an element, the finder can return either the container element for the field, or undefined.
     */
    , fields: {
      /**
       * A field finder for HTML's builtin form inputs.
       *
       * @param element An element to search up from.
       * @returns {(DOMElement|undefined)}
       */
      html: function ( element ) {
        if ( $( element ).is( "input, select, textarea" ) ) {
          return element;
        }
      }
    }


    /**
     *
     * Plugin API:
     *
     * - constructor( {LiveParsleyField} );
     * - beforeValidate( {{[event: DOMEvent]}} );
     * - afterValidate()
     */
    , plugins: {

      /**
       * Abandons validation unless triggered by an appropriate event.
       *
       * @param {Field} field
       */
      'triggers': function ( field ) {
        return {
          beforeValidate: function ( options ) {
            if ( options.event ) {
              if ( $.inArray( options.event.type, field.triggers() ) === -1 ) {
                return false;
              }
            }
          }
        };
      }

      /**
       * Delays rapid validation until after the field has been validated once.
       *
       * @param {Field} field
       * @returns {{beforeValidate: Function, afterValidate: Function}}
       */
      , 'delayed-validation': function ( field ) {
        return {
          beforeValidate: function ( options ) {
            if ( options.event ) {
              var trigger = options.event.type,
                  triggers = field.triggers(),
                  forced = $.inArray( trigger, triggers ) !== -1,
                  delayableKey = $.inArray( trigger, [ 'keyup', 'change' ] ) !== -1,
                  shouldDelay = !field.getOption( 'validated-once' );

              if (!forced && delayableKey && shouldDelay) {
                return false;
              }
            }
          },

          afterValidate: function () {
            field.setOption( 'validated-once', true );
          }
        };
      }

      , 'validation-min-length': function ( field ) {
        var hooks = {},
            minLength = field.getOption( 'validation-min-length' ),
            validatedOnce = field.getOption( 'validated-once' );

        if ( minLength && !validatedOnce ) {
          hooks.beforeValidate = function () {
            var value = field.value()
            if ( value && value.length < minLength ) {
              return false;
            }
          };
        }

        return hooks;
      }

      /**
       * Delays validation until after another field has been validated.
       *
       * @param field
       * @returns {{beforeValidate: Function}}
       */
      , 'validate-after': function ( field ) {
        var hooks = {},
            selector = field.getOption( 'validate-after' );

        if ( selector ) {
          hooks.beforeValidate = function () {
            var other = new Field( selector );

            if ( !other.getOption( 'validated-once' ) ) {
              return false;
            }
          }
        }

        return hooks;
      }
    }

    /**
     * Constraints are simply functions that returns true or false. They differ from validators in that constraints are
     * given the field on creation, as opposed to validators which only take a value on validation.
     */
    , constraints: {
      required: function ( field ) {
        if ( field.$el.hasClass( 'required' ) || field.$el.prop( 'required' ) ) {
          return function ( value ) {
            return {
              message: "required"
              , valid: PCrispum.validators.notnull( value )
                    && PCrispum.validators.notblank( value)
            };
          }
        }
      }

      , regexp: function (field) {
        var flags,
            pattern;

        flags = field.getOption( 'regexp-flags' ) || ''; // TODO: document this
        pattern = field.$el.attr( 'pattern' ) || field.getOption( 'regexp' );

        if ( pattern ) {
          return function ( value ) {
            return {
              message: "regexp"
              , valid: new RegExp( pattern, flags ).test( value )
            };
          }
        }
      }

      , min: function ( field ) {
        var type = field.$el.attr( 'type' ),
            min = field.$el.attr( 'min' );

        if ( min !== void 0 && $.inArray( type, [ 'number', 'range' ] ) !== -1 ) {
          return function ( value ) {
            return {
              message: "min"
              , valid: PCrispum.validators.min( value, min )
              , params: {
                min: min
              }
            };
          }
        }
      }

      , max: function ( field ) {
        var type = field.$el.attr( 'type' ),
            max = field.$el.attr( 'max' );

        if ( max !== void 0 && $.inArray(type, [ 'number', 'range' ]) !== -1 ) {
          return function ( value ) {
            return {
              message: "max"
              , params: {
                max: max
              }
              , valid: PCrispum.validators.min( value, max )
            };
          }
        }
      }

      , type: function ( field ) {
        var type = field.type(),
            supported = ['alphanum', 'dateIso', 'digits', 'email', 'number', 'phone', 'url', 'urlstrict'];

        if ( $.inArray( type, supported ) !== -1 ) {
          return function ( value ) {
            return {
              message: "type." + type
              , valid: PCrispum.validators.type( value, type )
            };
          }
        }
      }
    }

    /**
    * Validator list. Built-in validators functions
    *
    * @property validators
    * @type {Object}
    */
    , validators: {
      notnull: function ( val ) {
        return val.length > 0;
      }

      , notblank: function ( val ) {
        return 'string' === typeof val && '' !== val.replace( /^\s+/g, '' ).replace( /\s+$/g, '' );
      }

      , type: function ( val, type ) {
        var regExp;

        switch ( type ) {
          case 'number':
            regExp = /^-?(?:\d+|\d{1,3}(?:,\d{3})+)?(?:\.\d+)?$/;
            break;
          case 'digits':
            regExp = /^\d+$/;
            break;
          case 'alphanum':
            regExp = /^\w+$/;
            break;
          case 'email':
            regExp = /^((([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+(\.([a-z]|\d|[!#\$%&'\*\+\-\/=\?\^_`{\|}~]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])+)*)|((\x22)((((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(([\x01-\x08\x0b\x0c\x0e-\x1f\x7f]|\x21|[\x23-\x5b]|[\x5d-\x7e]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(\\([\x01-\x09\x0b\x0c\x0d-\x7f]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))))*(((\x20|\x09)*(\x0d\x0a))?(\x20|\x09)+)?(\x22)))@((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]))){2,6}$/i;
            break;
          case 'url':
            val = new RegExp( '(https?|s?ftp|git)', 'i' ).test( val ) ? val : 'http://' + val;
            /* falls through */
          case 'urlstrict':
            regExp = /^(https?|s?ftp|git):\/\/(((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:)*@)?(((\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5])\.(\d|[1-9]\d|1\d\d|2[0-4]\d|25[0-5]))|((([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|\d|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.)+(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])*([a-z]|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])))\.?)(:\d*)?)(\/((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)+(\/(([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)*)*)?)?(\?((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|[\uE000-\uF8FF]|\/|\?)*)?(#((([a-z]|\d|-|\.|_|~|[\u00A0-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF])|(%[\da-f]{2})|[!\$&'\(\)\*\+,;=]|:|@)|\/|\?)*)?$/i;
            break;
          case 'dateIso':
            regExp = /^(\d{4})\D?(0[1-9]|1[0-2])\D?([12]\d|0[1-9]|3[01])$/;
            break;
          case 'phone':
            regExp = /^((\+\d{1,3}(-| )?\(?\d\)?(-| )?\d{1,5})|(\(?\d{2,6}\)?))(-| )?(\d{3,4})(-| )?(\d{4})(( x| ext)\d{1,5}){0,1}$/;
            break;
          default:
            return false;
        }

        // test regExp if not null
        return '' !== val ? regExp.test( val ) : false;
      }

      , regexp: function ( val, regExp, self ) {
        return new RegExp( regExp, self.options.regexpFlag || '' ).test( val );
      }

      , minlength: function ( val, min ) {
        return val.length >= min;
      }

      , maxlength: function ( val, max ) {
        return val.length <= max;
      }

      , min: function ( val, min ) {
        return Number( val ) >= min;
      }

      , max: function ( val, max ) {
        return Number( val ) <= max;
      }
    }
  };

  function coerce ( value ) {
    var dummy = $( "<div/>" );
    dummy.data( "x", value );
    return dummy.data( "x" );
  }

  function Field ( element ) {
    this.$el = $( element );
  }

  Field.prototype = {

    validatorOrder: function () {
      var ordering = (this.getOption( 'validators' ) || '').split( /\s+/ ),
          order = [];

      for ( var i in ordering ) {
        if ( ordering[ i ].length > 0 ) {
          order.push( ordering[ i ] );
        }
      }

      return order;
    }

    , validators: function () {
      var field = this,
          sorted = {},
          order = this.validatorOrder(),
          validators = {};

      $.each( PCrispum.constraints, function ( name, detector ) {
        var validator = detector( field );

        if ( validator ) {
          validators[ name ] = validator;
        }
      });

      if ( order.length === 0 ) {
        sorted = validators;
      } else {
        $.each( order, function ( index, name ) {
          if ( validators.hasOwnProperty( name ) ) {
            sorted[ name ] = validators[ name ];
          }
        } );
      }

      return sorted;
    }

    , getOption: function ( name ) {
      var value = this.$el.attr( "data-" + name );
      if ( value !== void 0 ) {
        return coerce( value );
      }
    }

    , setOption: function (name, value) {
      this.$el.attr("data-" + name, value);
    }

    /**
     * Return the 'type' of the field.
     *
     * @returns {string}
     */
    , type: function () {
      var type = this.$el.attr( 'type'),
          override = this.getOption( 'type' );

      if ( override ) {
        type = override;
      }

      return type;
    }

    /**
     * Returns a list of events that should trigger validation.
     *
     * @returns {string[]}
     */
    , triggers: function () {
      var triggers = $.trim(this.getOption( 'trigger' ) || '');

      if ( triggers.length ) {
        triggers = triggers.split( /\s+/ );
      } else {
        triggers = [];
      }

      // alaways bind keyup event, for better UX when a field is invalid
      if ( $.inArray( 'keypress', triggers ) === -1 &&
           $.inArray( 'keydown', triggers ) === -1 &&
           $.inArray( 'keyup', triggers ) === -1 ) {
        triggers.push( 'keyup' );
      }

      // alaways bind change event, for better UX when a select is invalid
      if ( this.$el.is( 'select' ) && $.inArray( 'change', triggers ) === -1 ) {
        triggers.push( 'change' );
      }

      return triggers;
    }

    , plugins: function () {
      var field = this,
          plugins = {};

      $.each( PCrispum.plugins, function ( name, plugin ) {
        plugins[ name ] = plugin( field );
      } );

      return plugins;
    }

    , value: function () {
      var value = this.getOption( "value" );

      if ( value !== undefined ) {
        value = eval("window." + value);
      } else {
        value = this.$el.val();
      }

      return value;
    }

    , errorClassHandler: function () {
      return this.getOption( 'error-class-handler' ) || this.$el.parent();
    }

    /**
     * Validate the field.
     *
     * @param {DOMEvent} [event] The DOM event that triggered the validation.
     * @returns {boolean} true if the field is valid, false if it's invalid, undefined if no validation
     */
    , validate: function ( event ) {
      var results = {},
          plugins = this.plugins(),
          validators = this.validators(),
          value = this.value(),
          valid = true,
          validate = true;

      // Run plugin beforeValidate hooks, allowing validation to be aborted
      $.each( plugins, function ( name, plugin ) {
        var proceed;

        if ( plugin.beforeValidate ) {
          proceed = plugin.beforeValidate( {
            event: event
          } );

          if ( proceed === false ) {
            validate = false;
          }
        }
      } );

      // If no plugin has tried to abort, proceed with validation
      if ( validate ) {
        $.each( validators, function ( name, validator ) {
          results[ name ] = validator( value );
          if ( results[ name ].valid === false ) {
            valid = false;
          }
        } );

        // Run plugin afterValidate hooks
        $.each( plugins, function ( name, plugin ) {
          plugin.afterValidate && plugin.afterValidate( {
            results: results
          } );
        } );

        this.manageValidationResult( results );

        return valid;
      }
    }

    /**
     * Fired when all validators have be executed
     * Returns true or false if field is valid or not
     * Display errors messages below failed fields
     * Adds parsley-success or parsley-error class on fields
     *
     * @method manageValidationResult
     * @param {{ConstraintName: Boolean, ...}}
     * @return {Boolean} Is field valid or not
     */
    , manageValidationResult: function ( results ) {
      var allValid = null,
          errorClass = this.getOption( 'error-class' ),
          field = this,
          successClass = this.getOption( 'success-class' );


      $.each( results, function ( name, result ) {
        if ( false === result.valid ) {
          field.addError( name, result );
          allValid = false;
        } else if ( true === result.valid ){
          field.removeError( name );
          if ( allValid === null ) {
            allValid = true;
          }
        }
      } );

      if ( true === allValid ) {
        this.removeErrors();
        this.errorClassHandler().removeClass( errorClass ).addClass( successClass );
        return true;
      } else if ( false === allValid ) {
        this.errorClassHandler().removeClass( successClass ).addClass( errorClass );
        return false;
      }

      return allValid;
    }

    , errorsContainer: function () {
      var container,
          selector = '#' + this.hash();

      container = $( selector );

      if ( container.length === 0 ) {
        container = $( '<ul></ul>' ).attr( {
          'id': this.hash(),
          'class': 'parsley-error-list'
        } );
        container.insertAfter( this.$el );
      }

      return container;
    }

    , hash: function () {
      var hash = this.getOption( 'hash' );
      if ( undefined === hash ) {
        hash = this.generateHash();
        this.setOption( 'hash', hash );
      }
      return hash;
    }

    , generateHash: function () {
      return 'parsley-' + ( Math.random() + '' ).substring( 2 );
    }

    /**
     * Remove li / ul error
     *
     * @method removeError
     * @param {String} constraintName Method Name
     */
    , removeError: function ( name ) {
      var li = this.errorsContainer().find( '.' + name);

      function tidy () {
        var parent = li.parent();

        li.remove();

        if ( parent.length === 0 ) {
          parent.remove();
        }
      }

      if ( li.length ) {
        if ( this.getOption( 'animate' ) ) {
          li.fadeOut( this.getOption( 'animate-duration' ), tidy );
        } else {
          tidy();
        }
      }
    }

    /**
     * Add li error
     *
     * @method addError
     * @param {Object} { minlength: "error message for minlength constraint" }
     */
    , addError: function ( name, result ) {
      var li,
          message;

      li = this.errorsContainer().find("." + name);
      message = eval("PCrispum.messages." + result.message);
      message = sprintf( message, result.params || {} );

      if ( li.length === 0 ) {
        li = $( '<li></li>' ).addClass( name );
      }

      li.html( message );

      if ( this.getOption( 'animate') ) {
        li.hide().fadeIn( this.getOption( 'animate-duration') )
      }

      this.errorsContainer().append( li );
    }

    /**
     * Remove all ul / li errors
     *
     * @method removeErrors
     */
    , removeErrors: function () {
      this.getOption( 'animate') ? this.errorsContainer().fadeOut( this.getOption( 'animate-duration' ), function () { $( this ).remove(); } ) : this.errorsContainer().remove();
    }

    /**
     * Remove ul errors and parsley error or success classes
     *
     * @method reset
     */
//    , reset: function () {
//      this.valid = null;
//      this.removeErrors();
//      this.validatedOnce = false;
//      this.errorClassHandler.removeClass( this.options.successClass ).removeClass( this.options.errorClass );
//
//      for ( var constraint in this.constraints ) {
//        this.constraints[ constraint ].valid = null;
//      }
//
//      return this;
//    }

    /**
     * Create ul error container
     *
     * @method manageErrorContainer
     */
    , manageErrorContainer: function () {
      var errorContainer = this.options.errorContainer || this.options.errors.container( this.element, this.isRadioOrCheckbox )
          , ulTemplate = this.options.animate ? this.ulTemplate.show() : this.ulTemplate;

      if ( 'undefined' !== typeof errorContainer ) {
        $( errorContainer ).append( ulTemplate );
        return;
      }

      !this.isRadioOrCheckbox ? this.$element.after( ulTemplate ) : this.$element.parent().after( ulTemplate );
    }
  };

  /**
   * Format a string, with named parameters:
   *
   * > format("Hi {name}!", {name: "Brad"})
   * "Hi Brad!"
   *
   * @param {string} template
   * @param {object} parameters
   */
  function sprintf ( template, parameters ) {
    var formatted = template;

    function escapeRegExp( str ) {
      return str.replace( /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&" );
    }

    $.each( parameters, function ( replacement, needle ) {
      formatted = formatted.replace( new RegExp( "{" + escapeRegExp( needle ) + "}" ), replacement );
    } );
    return formatted;
  }

  function findField ( element ) {
    var field;

    $.each( PCrispum.fields, function ( name, finder ) {
      field = finder( element );
      if ( field ) {
        field = new Field( field );
        return false;
      }
    } );

    return field;
  }

  $( document ).on( 'focus blur change keydown keypress keyup input', function ( e ) {
    var field;

    field = findField ( e.target );

    if ( field ) {
      field.validate ( e );
    }
  } );

}(window.jQuery || window.Zepto);

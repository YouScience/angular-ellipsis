/**
 *	Angular directive to truncate multi-line text to visible height
 *
 *	@param bind (angular bound value to append) REQUIRED
 *	@param ellipsisAppend (string) string to append at end of truncated text after ellipsis, can be HTML OPTIONAL
 *	@param ellipsisAppendClick (function) function to call if ellipsisAppend is clicked (ellipsisAppend must be clicked) OPTIONAL
 *	@param ellipsisSymbol (string) string to use as ellipsis, replaces default '...' OPTIONAL
 *	@param ellipsisSeparator (string) separator to split string, replaces default ' ' OPTIONAL
 *
 *	@example <p data-ellipsis data-ng-bind="boundData"></p>
 *	@example <p data-ellipsis data-ng-bind="boundData" data-ellipsis-symbol="---"></p>
 *	@example <p data-ellipsis data-ng-bind="boundData" data-ellipsis-append="read more"></p>
 *	@example <p data-ellipsis data-ng-bind="boundData" data-ellipsis-append="read more" data-ellipsis-append-click="displayFull()"></p>
 *
 */
angular.module('dibari.angular-ellipsis', [])

.directive('ellipsis', ['$timeout', '$window', '$sce', function($timeout, $window, $sce) {

  var AsyncDigest = function(delay) {
    var timeout = null;
    var queue = [];

    this.remove = function(fn) {
      if (queue.indexOf(fn) !== -1) {
        queue.splice(queue.indexOf(fn), 1);
        if (queue.length === 0) {
          $timeout.cancel(timeout);
          timeout = null;
        }
      }
    };
    this.add = function(fn) {
      if (queue.indexOf(fn) === -1) {
        queue.push(fn);
      }
      if (!timeout) {
        timeout = $timeout(function() {
          var copy = queue.slice();
          timeout = null;
          // reset scheduled array first in case one of the functions throws an error
          queue.length = 0;
          copy.forEach(function(fn) {
            fn();
          });
        }, delay);
      }
    };
  };

  var asyncDigestImmediate = new AsyncDigest(0);
  var asyncDigestDebounced = new AsyncDigest(75);

  return {
    restrict: 'A',
    scope: {
      ngBind: '=',
      ngBindHtml: '=',
      ellipsisAppend: '@',
      ellipsisAppendClick: '&',
      ellipsisSymbol: '@',
      ellipsisSeparator: '@',
      useParent: "@",
      ellipsisSeparatorReg: '='
    },
    compile: function(elem, attr, linker) {

      return function(scope, element, attributes) {
        /* Window Resize Variables */
        attributes.lastWindowResizeTime = 0;
        attributes.lastWindowResizeWidth = 0;
        attributes.lastWindowResizeHeight = 0;
        attributes.lastWindowTimeoutEvent = null;
        /* State Variables */
        attributes.isTruncated = false;

        function getParentHeight(element) {
          var heightOfChildren = 0;
          angular.forEach(element.parent().children(), function(child) {
            if (child != element[0]) {
              heightOfChildren += child.clientHeight;
            }
          });
          return element.parent()[0].clientHeight - heightOfChildren;
        }

        var domElement = element[0];

        function getEmptySpaceLocations(text) {
          var spaceIndices = [];
          var re = /\s+/gm;
          var match;
          while ((match = re.exec(text)) !== null) {
            spaceIndices.push(match.index);
          }
          return spaceIndices;
        }

        function getSubText(fullText, spaceIndices, index) {
          return fullText.substr(0, spaceIndices[index]);
        }

        function isSubTextOverflow(fullText, spaceIndices, index, appendString) {
          var text = getSubText(fullText, spaceIndices, index);
          domElement.innerHTML = text + appendString;
          return isOverflown(element);
        }

        function buildEllipsis() {
          if (typeof(scope.ngBind) !== 'undefined') {
            var text = scope.ngBind;
            var spaceIndices = getEmptySpaceLocations(text);
            attributes.isTruncated = false;
            element.html(text);
            var desiredHeight = element[0].clientHeight;
            var actualHeight = element[0].scrollHeight;
            if (actualHeight > desiredHeight) {
              var totalSpaceLocations = spaceIndices.length;
              var begin = 0;
              var end = totalSpaceLocations - 1;
              var lastOverflown = true;
              var currentIndex;
              var currentOverflown = true;
              var notFound = true;
              var seekedTimes = 0;
              var ellipsisSymbol = (typeof(attributes.ellipsisSymbol) !== 'undefined') ? attributes.ellipsisSymbol : '&hellip;';
              var appendString = (typeof(scope.ellipsisAppend) !== 'undefined' && scope.ellipsisAppend !== '') ? ellipsisSymbol + '<span>' + scope.ellipsisAppend + '</span>' : ellipsisSymbol;
              while (notFound) {
                currentIndex = begin + ((end - begin) >> 1);
                currentOverflown = isSubTextOverflow(text, spaceIndices, currentIndex, appendString);
                seekedTimes++;
                if ((currentOverflown !== lastOverflown) && (end - begin) === 1) {
                  notFound = false;
                } else {
                  if (currentOverflown) {
                    end = currentIndex;
                  } else {
                    begin = currentIndex;
                  }
                }
              }
              var truncatedText = getSubText(text, spaceIndices, currentIndex) + appendString;
              element.html(truncatedText);
              attributes.isTruncated = true;

							// If append string was passed and append click function included
							if (ellipsisSymbol !== appendString && typeof(scope.ellipsisAppendClick) !== 'undefined' && scope.ellipsisAppendClick !== '') {
							  element.find('span').bind("click", function(e) {
							    scope.$apply(function() {
							      scope.ellipsisAppendClick.call(scope, {
							        event: e
							      });
							    });
							  });
							}
            }
          }
        }

				function isOverflown(thisElement) {
					return thisElement[0].scrollHeight > thisElement[0].clientHeight;
				}

        /**
         *	Test if element has overflow of text beyond height or max-height
         *
         *	@param element (DOM object)
         *
         *	@return bool
         *
         */
        function isOverflowed(thisElement, useParent) {
          thisElement = useParent ? thisElement.parent() : thisElement;
          return thisElement[0].scrollHeight > thisElement[0].clientHeight;
        }

        /**
         *	Watchers
         */

        /**
         *	Execute ellipsis truncate on ngBind update
         */
        scope.$watch('ngBind', function() {
          asyncDigestImmediate.add(buildEllipsis);
        });

        /**
         *	Execute ellipsis truncate on ngBindHtml update
         */
        scope.$watch('ngBindHtml', function() {
          asyncDigestImmediate.add(buildEllipsis);
        });

        /**
         *	Execute ellipsis truncate on ngBind update
         */
        scope.$watch('ellipsisAppend', function() {
          buildEllipsis();
        });

        /**
         *	Execute ellipsis truncate when element becomes visible
         */
        scope.$watch(function() {
          return element[0].offsetWidth !== 0 && element[0].offsetHeight !== 0;
        }, function() {
          asyncDigestDebounced.add(buildEllipsis);
        });

        function checkWindowForRebuild() {
          if (attributes.lastWindowResizeWidth != window.innerWidth || attributes.lastWindowResizeHeight != window.innerHeight) {
            buildEllipsis();
          }

          attributes.lastWindowResizeWidth = window.innerWidth;
          attributes.lastWindowResizeHeight = window.innerHeight;
        }

        var unbindRefreshEllipsis = scope.$on('dibari:refresh-ellipsis', function() {
          asyncDigestImmediate.add(buildEllipsis);
        });
        /**
         *	When window width or height changes - re-init truncation
         */

        function onResize() {
          asyncDigestDebounced.add(checkWindowForRebuild);
        }

        var $win = angular.element($window);
        $win.bind('resize', onResize);

        /**
         * Clean up after ourselves
         */
        scope.$on('$destroy', function() {
          $win.unbind('resize', onResize);
          asyncDigestImmediate.remove(buildEllipsis);
          asyncDigestDebounced.remove(checkWindowForRebuild);
          if (unbindRefreshEllipsis) {
            unbindRefreshEllipsis();
            unbindRefreshEllipsis = null;
          }
        });


      };
    }
  };
}]);

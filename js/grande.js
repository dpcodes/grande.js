(function(w, d) {
  /*jshint multistr:true */
  var EDGE = -999;
  var IMAGE_URL_REGEX = /^https?:\/\/(.*)\.(jpg|png|gif|jpeg)(\?.*)?/i;
  var YOUTUBE_URL_REGEX = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/ ]{11})/;
  var VINE_URL_REGEX = /^http(?:s?):\/\/(?:www\.)?vine\.co\/v\/([a-zA-Z0-9]{1,13})/;
  var GUID_ENABLED_TAGS = 'P BLOCKQUOTE LI H1 H2 H3 H4 H5 H6 FIGURE PRE'.split(' ');
  var INLINE_ELEMENTS = 'B BR BIG I SMALL ABBR ACRONYM CITE EM STRONG A BDO SPAN SUB SUP #text'.split(' ');

  var Grande = Grande || function (bindableNodes, userOpts) {

    var root = w,   // Root object, this is going to be the window for now
        document = d, // Safely store a document here for us to use
        editableNodes = bindableNodes || document.querySelectorAll(".g-body article"),
        editNode = bindableNodes[0], // TODO: cross el support for imageUpload
        isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1,
        options = {
          containerSelector: 'body',
          animate: true,
          placeholder: null,
          mode: "rich", // inline, rich, partial
          rtl: false,
          imagesFromUrls: false, // Convert images urls to <img>s. Must be "rich" mode.
          allowImages: false,
          enableGuids: false,
          guidAttribute: 'id',
          imageTooltipLabel: 'Insert Image',
          urlInputPlaceholder: 'Paste or type a link',
          sanitizePastedContent: true,
          openLinksInBlank: true,
          // This will be called when a user select an image to insert into the article.
          // It should accept two params (filesList, insertImageCallback(imgurl)).
          // filesList is going to be the list of files the user selected,
          // and insertImageCallback needs to be called with the uploaded image url.
          // The callback needs to take care of uploading the image to a host.
          uploadCallback: null
        },
        textMenu,
        optionsNode,
        urlInput,
        previouslySelectedText,
        imageTooltip,
        imageInput,
        currentElement,
        scrollTopBegin,

        init = function(nodes, opts) {
          options = extend(options, opts);

          attachToolbarTemplate();
          initPlaceholder();
          bindTextSelectionEvents();
          bindTextStylingEvents();
        },

        select = function() {
          triggerTextSelection();
        },

        tagClassMap = {
          "b": "bold",
          "i": "italic",
          "h1": "header1",
          "h2": "header2",
          "a": "url",
          "pre": "code",
          "blockquote": "quote"
        };


    function extend(destination, userOpts) {
      for (var property in userOpts) {
        destination[property] = userOpts[property];
      }
      return destination;
    }

    function initPlaceholder() {
      if (options.placeholder) {
        var p, node;

        for (var i = 0, len = editableNodes.length; i < len; i++) {
          node = editableNodes[i];
          if (node[getTextProp(node)].trim()) {
            continue;
          }

          addPlaceholder(node, options.placeholder);
          node.onblur = triggerContentBlur;
          node.onfocus = triggerContentFocus;
        }
      }
    }

    /**
     * Generates a random GUID-like string.
     * REF: http://goo.gl/mYz5Ax.
     * @return {string} A GUID-like string.
     */
    function guid() {
      var guidFormat = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
      return guidFormat.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
      });
    }

    /**
     * Sets element id attribute to a unique ID.
     * @param {HTMLElement} element Element to set its ID.
     */
    function setElementGUID(element) {
      if (options.enableGuids && element) {
        element.setAttribute(options.guidAttribute, guid());
        if (element.className.indexOf('guid-tagged') == -1) {
          element.className += ' guid-tagged';
        }
      }
    }

    /**
     *
     */
    function getGuidEnabledNode(element) {
       if (GUID_ENABLED_TAGS.indexOf(element.tagName) !== -1) {
        return element;
       }
       if (element.parentNode !== editNode) {
         return getGuidEnabledNode(element.parentNode);
       }
    }

    function addPlaceholder(el, text) {
      // Remove any <br> elements.
      var brs = el.getElementsByTagName('br');
      for (var i = 0; i < brs.length; i++) { brs[i].parentNode.removeChild(brs[i]); }
      var p = document.createElement("p");
      p[getTextProp(p)] = text;
      p.className = "g-placeholder";
      el.appendChild(p);
    }

    function attachToolbarTemplate() {
      var div = document.createElement("div"),
          toolbarTemplate = "<div class='options'> \
            <span class='no-overflow'> \
              <span class='ui-inputs'> \
                <button class='bold'>B</button> \
                <button class='italic'>i</button> \
                <button class='header1'>h1</button> \
                <button class='header2'>h2</button> \
                <button class='quote'>&rdquo;</button> \
                <button class='url useicons'>&#xe001;</button> \
                <button class='code'>&lt;&gt;</button> \
                <input class='url-input' type='text' placeholder='"+options.urlInputPlaceholder+"'/> \
              </span> \
            </span> \
          </div>",
          imageTooltipTemplate = document.createElement("div"),
          toolbarContainer = document.createElement("div");

      toolbarContainer.className = "g-body";
      document.body.appendChild(toolbarContainer);

      imageTooltipTemplate.innerHTML = "\
        <div class='pos-abs file-label'><div class='file-label-container'>" +
          options.imageTooltipLabel +
        "</div></div> \
        <input class='file-hidden pos-abs' type='file' id='files' name='files[]' accept='image/*' multiple/>";
      imageTooltipTemplate.className = "image-tooltip";

      div.className = "text-menu hide";
      div.innerHTML = toolbarTemplate;

      // TODO(mkhatib): Need to clean up these elements and add a way to destroy them.
      toolbarContainer.appendChild(div);
      toolbarContainer.appendChild(imageTooltipTemplate);

      imageInput = toolbarContainer.querySelectorAll(".file-label + input")[0];
      imageTooltip = toolbarContainer.querySelectorAll(".image-tooltip")[0];
      imageTooltip.style.top = EDGE + 'px';
      imageTooltip.style.left = EDGE + 'px';
      textMenu = toolbarContainer.querySelectorAll(".text-menu")[0];
      optionsNode = toolbarContainer.querySelectorAll(".text-menu .options")[0];
      urlInput = toolbarContainer.querySelectorAll(".text-menu .url-input")[0];

      editNode.onblur = hideSideMenu;
    }

    function bindTextSelectionEvents() {
      var i,
          len,
          node;

      // Handle window resize events
      root.onresize = triggerTextSelection;

      urlInput.onblur = triggerUrlBlur;
      urlInput.onkeydown = triggerUrlSet;

      for (i = 0, len = editableNodes.length; i < len; i++) {
        node = editableNodes[i];
        node.contentEditable = true;
        node.className = node.className + " g-editor";

        if (options.allowImages && options.uploadCallback) {
          imageTooltip.onmousedown = triggerImageUpload;
          imageInput.onchange = uploadImage;
        }

        // Handles pasting events to make sure to sanitize and cleanup the markup.
        if (options.sanitizePastedContent) {
          node.onpaste = handlePaste;
        }

        // Trigger on both mousedown and mouseup so that the click on the menu
        // feels more instantaneously active
        node.onmouseup = function(event) {
          setTimeout(function() {
            triggerTextSelection(event);
          }, 1);
        };
        node.onkeydown = preprocessKeyDown;
        node.onkeyup = function(event){
          var sel = window.getSelection();

          // FF will return sel.anchorNode to be the parentNode when the triggered keyCode is 13
          var nodeName = sel.anchorNode && sel.anchorNode.nodeName;
          if (nodeName !== "ARTICLE") {
            triggerNodeAnalysis(event);

            if (sel.isCollapsed) {
              triggerTextParse(event);
            }
          } else if (nodeName === "ARTICLE") {
            triggerNodeAnalysis(event);
          }
        };
        node.onmousedown = triggerTextSelection;
      }
    }

    function triggerImageUpload(event) {
      // Cache the bound that was originally clicked on before the image upload
      var childrenNodes = editNode.children,
          editBounds = editNode.getBoundingClientRect();

      currentElement = getCurrentElementAtCursor();
    }

    function uploadImage(event) {
      if (options.uploadCallback && event.target.files.length) {
        // Prepare the figure and progress bar elements.
        var figureEl = document.createElement("figure");
        setElementGUID(figureEl);
        var progressEl = document.createElement("p");
        progressEl.className = "g-progress-bar";
        var progressIndicatorEl = document.createElement("span");
        progressEl.appendChild(progressIndicatorEl);
        figureEl.appendChild(progressEl);
        if (currentElement != editNode) {
          editNode.insertBefore(figureEl, currentElement);
        } else {
          editNode.appendChild(figureEl);
        }

        options.uploadCallback(this.files,
          // Upload complete callback.
          function(imageSrc) {
            figureEl.innerHTML = "<img src=\"" + imageSrc + "\"/>";
          },
          // Upload progress event.
          function (progress) {
            progressIndicatorEl.style.width = progress + "%";
          },
          // Upload Error event.
          function () {
            editNode.removeChild(figureEl);
          });

        imageInput.innerHTML = imageInput.innerHTML;
        imageInput.onchange = uploadImage;
      }
    }

    function scrollListener(e) {
      var containerEl = document.querySelector(options.containerSelector);
      var el = containerEl.documentElement || containerEl;
      var scrollTop = el.scrollTop || document.body.scrollTop;
      if (Math.abs(scrollTop - scrollTopBegin) > 40) {
        imageTooltip.style.top = EDGE + 'px';
        imageTooltip.style.left = EDGE + 'px';
        el.removeEventListener('scroll', scrollListener);
      }
    }

    function hideSideMenu(e) {
      // Need to add a timeout to allow a click event to happen on the image
      // tooltip before it gets hidden.
      setTimeout(function() {
        imageTooltip.style.top = EDGE + 'px';
        imageTooltip.style.left = EDGE + 'px';
      }, 100);
    }

    function toggleSideMenu(e) {
      var el = document.querySelector(options.containerSelector);
      scrollTopBegin = el.scrollTop || document.body.scrollTop;
      el = el.tagName === 'BODY' ? window : el;
      el.addEventListener('scroll', scrollListener);
      var selectedText = root.getSelection(),
          range,
          clientRectBounds,
          target = e.target || e.srcElement;

      // The selected text is not editable
      if (options.mode !== "rich") {
        return;
      }

      // The selected text is collapsed, push the menu out of the way
      if (selectedText.type != 'None') {
        range = selectedText.getRangeAt(0);
        clientRectBounds = range.getBoundingClientRect();
        if (clientRectBounds.height === 0) {
          if (range.startContainer.tagName === undefined) {
            clientRectBounds = range.startContainer.parentNode.getBoundingClientRect();
          } else {
            clientRectBounds = range.startContainer.getBoundingClientRect();
          }
        }
        var editBounds = editNode.getBoundingClientRect();
        var targetBounds = target.getBoundingClientRect();
        var editorTop = editBounds.top + root.pageYOffset;
        var targetTop = targetBounds.top + root.pageYOffset;
        var currentEditTop = clientRectBounds.top + root.pageYOffset;

        imageTooltip.style.top = (Math.max(editorTop, currentEditTop, targetTop) - 20) + "px";
        var width = imageTooltip.getElementsByClassName('file-label-container')[0].offsetWidth;
        if (!options.rtl) {
          imageTooltip.style.left = (editBounds.left - width - 10 ) + "px";
        } else {
          imageTooltip.style.left = (editBounds.right + width + 10 ) + "px";
        }
      }
    }

    function isEditorChild(childNode) {
      for (var i = 0; i < editNode.childNodes.length; i++) {
        if (childNode == editNode.childNodes[i]) {
          return true;
        }
      }

      return false;
    }

    function getCurrentElementAtCursor() {
      var selectedText = root.getSelection(),
          range,
          clientRectBounds,
          clientElement;

      // The selected text is collapsed, push the menu out of the way
      range = selectedText.getRangeAt(0);
      clientRectBounds = range.getBoundingClientRect();
      clientElement = range.startContainer;
      if (clientElement.tagName === undefined) {
        clientElement = clientElement.parentNode;
      }
      while (clientElement && clientElement != editNode &&
             (clientElement.tagName === undefined || !isEditorChild(clientElement))) {
        clientElement = clientElement.parentNode;
      }
      if (!clientElement) {
        clientElement = editNode;
      }
      clientRectBounds = clientElement.getBoundingClientRect();

      var editBounds = editNode.getBoundingClientRect();
      var editorTop = editBounds.top + root.pageYOffset;
      var currentEditTop = clientRectBounds.top + root.pageYOffset;

      return (editorTop > currentEditTop) ? editNode : clientElement;
    }

    function iterateTextMenuButtons(callback) {
      var textMenuButtons = textMenu.querySelectorAll("button"),
          i,
          len,
          node,
          fnCallback = function(n) {
            callback(n);
          };

      for (i = 0, len = textMenuButtons.length; i < len; i++) {
        node = textMenuButtons[i];

        fnCallback(node);
      }
    }

    function bindTextStylingEvents() {
      iterateTextMenuButtons(function(node) {
        node.onmousedown = function(event) {
          triggerTextStyling(node);
        };
      });
    }

    function getFocusNode() {
      return root.getSelection().focusNode;
    }

    function reloadMenuState() {
      var className,
          focusNode = getFocusNode(),
          tagClass,
          reTag;

      iterateTextMenuButtons(function(node) {
        className = node.className;

        for (var tag in tagClassMap) {
          tagClass = tagClassMap[tag];
          reTag = new RegExp(tagClass);

          if (reTag.test(className)) {
            if (hasParentWithTag(focusNode, tag)) {
              node.className = tagClass + " active";
            } else {
              node.className = tagClass;
            }

            break;
          }
        }
      });
    }

    // Reference for selection saving: http://goo.gl/8wNYSa
    function saveSelection(containerEl) {
      var charIndex = 0, start = 0, end = 0, foundStart = false, stop = {};
      var noText = false;
      var sel = window.getSelection(), range;

      function traverseTextNodes(node, range) {
        if (node.nodeType == 3 || node == range.startContainer || node == range.endContainer) {
          if (!foundStart && node == range.startContainer) {
            start = charIndex + range.startOffset;
            foundStart = true;
          }
          if (foundStart && node == range.endContainer) {
            end = charIndex + range.endOffset;
            noText = node.nodeType != 3;
            throw stop;
          }
          charIndex += node.length;
        } else {
          for (var i = 0, len = node.childNodes.length; i < len; ++i) {
            traverseTextNodes(node.childNodes[i], range);
          }
        }
      }

      if (sel.rangeCount) {
        try {
          traverseTextNodes(containerEl, sel.getRangeAt(0));
        } catch (ex) {
          if (ex != stop) {
            throw ex;
          }
        }
      }

      var containerEl = document.querySelector(options.containerSelector);
      return {
          start: start,
          end: end,
          noText: noText,
          scroll: containerEl.scrollTop
      };
    }

    function restoreSelection(containerEl, savedSel) {
      var charIndex = 0, range = document.createRange(), foundStart = false, stop = {};
      range.setStart(containerEl, 0);
      range.collapse(true);

      function traverseTextNodes(node) {
          if (node.nodeType == 3) {
              var nextCharIndex = charIndex + node.length;
              if (!foundStart && savedSel.start >= charIndex && savedSel.start <= nextCharIndex) {
                  range.setStart(node, savedSel.start - charIndex);
                  foundStart = true;
              }
              if (foundStart && savedSel.end >= charIndex && savedSel.end <= nextCharIndex) {
                  range.setEnd(node, savedSel.end - charIndex);
                  throw stop;
              }
              charIndex = nextCharIndex;
          } else {
              for (var i = 0, len = node.childNodes.length; i < len; ++i) {
                  traverseTextNodes(node.childNodes[i]);
              }
          }
      }

      try {
          traverseTextNodes(containerEl);
      } catch (ex) {
          if (ex == stop) {
              var sel = window.getSelection();
              sel.removeAllRanges();
              sel.addRange(range);
              var containerEl = document.querySelector(options.containerSelector);
              containerEl.scrollTop = savedSel.scroll;
          } else {
              throw ex;
          }
      }
    }

    // Paste handling reference: http://goo.gl/sMf61T
    function handlePaste(e) {
      var elem = this;
      var savedContent = elem.innerHTML;
      var savedSel = saveSelection(elem);
      // Webkit - get data from clipboard, put into editdiv, cleanup, then cancel event.
      if (e && e.clipboardData && e.clipboardData.getData) {
        var types = e.clipboardData.types;
        // Firefox have a specific datastructure for for types, so regex test
        // won't be able to run against it. Instead loop over the structure and
        // turn types into a normal array of string.
        if (isFirefox) {
          types = [];
          for(var i = 0; i < e.clipboardData.types.length; i++) {
            types.push(e.clipboardData.types[i]);
          }
        }
        if (/text\/html/.test(types)) {
          elem.innerHTML = e.clipboardData.getData('text/html');
        }
        else if (/text\/plain/.test(types)) {
          elem.innerHTML = e.clipboardData.getData('text/plain');
        }
        else {
          elem.innerHTML = "";
        }

        waitForPasteData(elem, savedContent, savedSel);
        if (e.preventDefault) {
          e.stopPropagation();
          e.preventDefault();
        }
        return false;
      }
      // Everything else - empty editdiv and allow browser to paste content into it, then cleanup
      else {
        elem.innerHTML = "";
        waitForPasteData(elem, savedContent, savedSel);
        return true;
      }
    }

    function waitForPasteData(elem, savedContent, savedSel) {
      if (elem.childNodes && elem.childNodes.length > 0) {
        processPaste(elem, savedContent, savedSel);
      }
      else {
        var that = { e: elem, s: savedContent, sel: savedSel };
        that.callSelf = function() {
            waitForPasteData(that.e, that.s, that.sel);
        };
        setTimeout(that.callSelf, 20);
      }
    }

    function hasOnlyInlineChildNodes(elem) {
      var children = elem.childNodes;
      for (var i = 0; i < children.length ; i++) {
        if (INLINE_ELEMENTS.indexOf(children[i].nodeName) === -1) {
          return false;
        }
      }
      return true;
    }

    function sanitizeInlineFormatting(elem) {
      var elHtml = [];
      var childChildren = elem.childNodes;
      for (var j = 0; j < childChildren.length; j++) {
        var currEl = childChildren[j];
        var nodeName = currEl.nodeName.toLowerCase()
        // Ignore brs.
        if (nodeName === 'br') {
          continue;
        } else if (nodeName === '#text' || nodeName === 'span') {
          elHtml.push(currEl[getTextProp(currEl)]);
        } else {
          var attrs = '';
          if (nodeName === 'a') {
            attrs = ' href="' + currEl.href + '"';
          }
          elHtml.push('<' + nodeName + attrs + '>' + currEl[getTextProp(currEl)] + '</' + nodeName + '>');
        }
      }
      return elHtml.join('');
    }

    function createHtmlForElement(tag, attrs, optInner) {
      var guidAttrs = '';
      if (options.enableGuids &&
          GUID_ENABLED_TAGS.indexOf(tag.toUpperCase()) !== -1) {
        guidAttrs = ' class="guid-tagged" ' + options.guidAttribute + '="' + guid() + '" ';
      }

      return ['<', tag, guidAttrs, '>', optInner, '</', tag, '>'].join('');
    }

    /**
     * Loop over children.
     *   if has block elements
     *   call the function again
     *  else if it's just text, get text.
     *  else if it is text with inline formatting
     *    loop over children append text and recreate inline formatting (to remove attributes.)
     *
     * @param  {HTMLElement} elem Element containing all pasted dom.
     * @return {Array.<string>} List of strings representing html to be put back.
     */
    function getSanitizedLines(elem) {
      var children = elem.childNodes;
      var j = 0;
      if (!children || !children.length) {
        return [elem[getTextProp(elem)]];
      }
      var lines = [];
      for (var i = 0; i < children.length; i++) {
        var el = children[i];
        var tag = el.nodeName && el.nodeName.toLowerCase();
        switch (tag) {
          case undefined:
          case 'meta':
          case 'script':
          case 'style':
          case 'embed':
          case 'br':
          case 'hr':
            continue;
          case 'img':
            var img = '<img src="' + el.getAttribute('src') + '"/>';
            lines.push(createHtmlForElement('figure', {}, img));
            break;
          case 'figure':
            // If the figure element has img elements.
            var imgs = el.getElementsByTagName('img');
            for (j = 0; j < imgs.length ; j++) {
              var img = '<img src="' + imgs[j].getAttribute('src') + '"/>';
              lines.push(createHtmlForElement('figure', {}, img));
            }

            // TODO(mkhatib): Only paste iFrames from whitelisted list.
            // If the figure element has iframes.
            var iframes = el.getElementsByTagName('iframe');
            for (j = 0; j < iframes.length ; j++) {
              var iframe = '<iframe src="' + iframes[j].getAttribute('src') + '"></iframe>';
              lines.push(createHtmlForElement('figure', {}, iframe));
            }
            break;
          case 'ul':
          case 'ol':
            var listHtml = ['<' + tag + '>'];
            var lis = el.getElementsByTagName('li');
            for (j = 0; j < lis.length ; j++) {
              listHtml.push(createHtmlForElement(
                  'li', {}, lis[j][getTextProp(lis[j])]));
            }
            listHtml.push('</' + tag + '>')
            lines.push(listHtml.join(''));
            break;
          case 'blockquote':
            lines.push(createHtmlForElement(
                'blockquote', {}, el[getTextProp(el)]));
            break;
          case 'h1':
            lines.push(createHtmlForElement('h1', {}, el[getTextProp(el)]));
            break;
          case 'h2':
          case 'h3':
          case 'h4':
          case 'h5':
          case 'h6':
            lines.push(createHtmlForElement('h2', {}, el[getTextProp(el)]));
            break
          case '#text':
            lines.push(createHtmlForElement('p', {}, el[getTextProp(el)]));
            break
          case 'pre':
            lines.push(createHtmlForElement('pre', {}, el[getTextProp(el)]));
            break;
          default:
            // To preserve inline styling.
            if (hasOnlyInlineChildNodes(children[i])) {
              var elHtml = sanitizeInlineFormatting(children[i]);
              lines.push(createHtmlForElement('p', {}, elHtml));
            } else {
              Array.prototype.push.apply(lines, getSanitizedLines(children[i]));
            }
        }
      }
      return lines;
    }

    function processPaste(elem, savedContent, savedSel) {
      var lines = getSanitizedLines(elem);
      var pastedData = elem[getTextProp(elem)];
      elem.innerHTML = savedContent;

      if (!savedSel.noText) {
        restoreSelection(elem, savedSel);
        if (pastedData.trim().indexOf('\n') == -1) {
          document.execCommand("insertText", false, pastedData.trim());
          return;
        }
      } else {
        var containerEl = document.querySelector(options.containerSelector);
        containerEl.scrollTop = savedSel.scroll;
        if (isFirefox) {
          restoreSelection(elem, savedSel);
          var cEl = getCurrentElementAtCursor();
          if (cEl != editNode && cEl.nextSibling) {
            moveCursorToBeginningOfSelection(window.getSelection(), cEl.nextSibling);
          }
        }
      }

      document.execCommand("insertHTML", false, lines.join(''));
    }

    function preprocessKeyDown(event) {
      var sel = window.getSelection(),
          parentParagraph = getParentWithTag(sel.anchorNode, "p"),
          parentPre = getParentWithTag(sel.anchorNode, "pre"),
          p,
          isHr,
          prevSibling;

      if (options.mode === "inline" && event.keyCode === 13) {
        event.preventDefault();
        return;
      }

      // If there is a div turn it into a paragraph.
      if (sel.anchorNode.nodeName === "DIV" ||
          sel.anchorNode.nodeName === undefined) {
        toggleFormatBlock("p");
        return true;
      } else if (sel.anchorNode.nodeName === '#text' &&
                 sel.anchorNode.parentNode &&
                 sel.anchorNode.parentNode.nodeName === 'DIV') {
        toggleFormatBlock("p");
        return true;
      }

      // If the selection isn't wrapped by any element. Put it inside a paragraph.
      if (sel.anchorNode.tagName === undefined &&
          sel.anchorNode.parentNode == editNode) {
        toggleFormatBlock("p");
      }

      if (event.keyCode === 13 && parentParagraph) {
        prevSibling = parentParagraph.previousSibling;
        isHr = prevSibling && prevSibling.nodeName === "HR" &&
          !(parentParagraph.textContent.length ||
            parentParagraph.getElementsByTagName('img').length);

        // Stop enters from creating another <p> after a <hr> on enter
        if (isHr) {
          event.preventDefault();
        }

        setTimeout(function() {
          toggleSideMenu(event);
        }, 100);
      }
      // When writing code, just insert a new line instead of a new pre element.
      else if (event.keyCode === 13 && parentPre) {
        document.execCommand("insertHtml", false, "\n");
        event.preventDefault();
        return false;
      }
    }

    function triggerNodeAnalysis(event) {
      var sel = window.getSelection(),
          anchorNode,
          parentParagraph;

      // If backspace is hit, re-add a paragragraph if there's no elements.
      if (event.keyCode === 8) {
        if (!editNode.childNodes || !editNode.childNodes.length) {
          toggleFormatBlock("p");
        }
      }

      if (event.keyCode === 13) {

        // Enters should replace it's parent <div> with a <p>
        if (sel.anchorNode.nodeName === "DIV" || sel.anchorNode.nodeName === undefined) {
          toggleFormatBlock("p");
        }

        // Replace figure elements on new line with a p and set focus on it.
        if (sel.anchorNode.nodeName === "FIGURE") {
          if (isFirefox) {
            moveCursorToBeginningOfSelection(sel, sel.anchorNode.nextSibling);
            toggleFormatBlock("p");
            if (sel.anchorNode.parentNode != editNode &&
                sel.anchorNode.parentNode.tagName != 'FIGURE') {
              sel.anchorNode.parentNode.innerHTML = '<br/>';
              sel.anchorNode.childNodes[0].focus();
            }
          } else {
            toggleFormatBlock("p");
            sel.anchorNode.parentNode.innerHTML = '<br/>';
            sel.anchorNode.childNodes[0].focus();
          }
        }

        if (sel.anchorNode.nodeName === 'BLOCKQUOTE') {
          if (isFirefox) {
            moveCursorToBeginningOfSelection(sel, sel.anchorNode.nextSibling);
          }
          toggleFormatBlock("p");
        }

        parentParagraph = getParentWithTag(sel.anchorNode, "p");

        if (parentParagraph) {
          insertHorizontalRule(parentParagraph);
        }
      }
    }

    function insertHorizontalRule(parentParagraph) {
      var prevSibling,
          prevPrevSibling,
          hr;

      prevSibling = parentParagraph.previousSibling;
      prevPrevSibling = prevSibling;

      while (prevPrevSibling) {
        if (prevPrevSibling.nodeType != Node.TEXT_NODE) {
          break;
        }

        prevPrevSibling = prevPrevSibling.previousSibling;
      }

      if (prevSibling && prevSibling.nodeName === "P" &&
          !prevSibling.textContent.length &&
          !prevSibling.getElementsByTagName('img').length &&
          prevPrevSibling.nodeName !== "HR") {
        hr = document.createElement("hr");
        hr.contentEditable = false;
        parentParagraph.parentNode.replaceChild(hr, prevSibling);
      }
    }

    function getTextProp(el) {
      var textProp;

      if (el.nodeType === Node.TEXT_NODE) {
        textProp = "data";
      } else if (isFirefox) {
        textProp = "textContent";
      } else {
        textProp = "innerText";
      }

      return textProp;
    }

    // TODO(mkhatib): There's a bug with inserting a quote at the very beginning
    // of the editing node.
    function insertQuoteOnSelection(sel, textProp) {
      var text = sel.anchorNode[textProp];
      if (text.length > 0 && text.match(/^["“'”]/)) {
        text = text.substring(1);
      }
      if (text.length > 0 && text.match(/["“'”]$/)) {
        text = text.substring(0, text.length - 1);
      }
      if (text.length === 0) {
        text = '&nbsp;';
      }
      sel.anchorNode[textProp] = '';

      var html = "<blockquote>" + text +"</blockquote>";
      document.execCommand("insertHTML", false, html);
      return getParentWithTag(sel.anchorNode, 'blockquote');
    }

    function insertListOnSelection(sel, textProp, listType) {
      var execListCommand = listType === "ol" ? "insertOrderedList" : "insertUnorderedList",
          nodeOffset = listType === "ol" ? 3 : 2;

      document.execCommand(execListCommand);
      sel.anchorNode[textProp] = sel.anchorNode[textProp].substring(nodeOffset);

      return getParentWithTag(sel.anchorNode, listType);
    }

    function insertImageOnSelection(sel, textProp) {
      var path = sel.anchorNode[textProp];
      sel.anchorNode[textProp] = '';
      // Prepare the figure and progress bar elements.
      var figureEl = document.createElement("figure");
      setElementGUID(figureEl);
      var currentElement = getCurrentElementAtCursor();
      if (currentElement != editNode) {
        editNode.insertBefore(figureEl, currentElement);
      } else {
        editNode.appendChild(figureEl);
      }
      figureEl.innerHTML = "<img src=\"" + path + "\"/>";
      return figureEl;
    }

    function insertVideoOnSelection(sel, textProp, vidType) {
      var path = sel.anchorNode[textProp];
      sel.anchorNode[textProp] = '';

      // Prepare the figure and progress bar elements.
      var figureEl = document.createElement("figure");
      setElementGUID(figureEl);
      var currentElement = getCurrentElementAtCursor();
      if (currentElement != editNode) {
        editNode.insertBefore(figureEl, currentElement);
      } else {
        editNode.appendChild(figureEl);
      }

      var re, matches, vidId, url;
      if(vidType == "youtube") {
        re = /[?&]?([^=]+)=([^&]*)/g;
        matches = re.exec(path);
        vidId = matches[2];
        url = "https://www.youtube.com/embed/" + vidId + "?modestbranding=1&showinfo=0&autohide=1&iv_load_policy=3";
        figureEl.innerHTML = "<iframe width='560' height='315' src='" + url + "'></iframe>";
      }

      else if(vidType == "vine") {
        re = /([a-zA-Z0-9]{11})/;
        matches = re.exec(path);
        vidId = matches[0];
        url = "https://vine.co/v/"+ vidId +"/embed/simple";
        figureEl.innerHTML = "<iframe width='480' height='480' src='" + url + "'></iframe>";
      }

      return figureEl;
    }

    function triggerTextParse(event) {
      var sel = window.getSelection(),
          textProp,
          subject,
          insertedNode,
          unwrap,
          node,
          parent,
          range;

      // FF will return sel.anchorNode to be the parentNode when the triggered keyCode is 13
      if (!sel.isCollapsed || !sel.anchorNode || sel.anchorNode.nodeName === "ARTICLE") {
        return;
      }

      textProp = getTextProp(sel.anchorNode);
      subject = sel.anchorNode[textProp];

      if (sel.anchorNode.tagName === undefined && sel.anchorNode.parentNode == editNode) {
        toggleFormatBlock("p");
      }

      if (subject.match(/^[-*]\s/) && sel.anchorNode.parentNode.nodeName !== "LI") {
        insertedNode = insertListOnSelection(sel, textProp, "ul");
      }

      if (subject.match(/^(1|١)[\.\-\)\(]\s/) && sel.anchorNode.parentNode.nodeName !== "LI") {
        insertedNode = insertListOnSelection(sel, textProp, "ol");
      }

      if (subject.match(/^["“'”]/) && sel.anchorNode.parentNode.nodeName !== "blockquote") {
        insertedNode = insertQuoteOnSelection(sel, textProp, "blockquote");
      }

      if (options.mode === "rich" && options.imagesFromUrls && subject.match(IMAGE_URL_REGEX)) {
        insertedNode = insertImageOnSelection(sel, textProp);
        // toggleFormatBlock('figure');
        if (insertedNode && insertedNode.tagName === 'FIGURE') {
          var sibling = insertedNode.previousSibling;
          if (sibling && sibling.tagName === 'P' && sibling.innerHTML.length === 0) {
            sibling.parentNode.removeChild(sibling);
          }
        }
      }

      if (subject.match(VINE_URL_REGEX)) {
        insertedNode = insertVideoOnSelection(sel, textProp, "vine");
      }

      if(subject.match(YOUTUBE_URL_REGEX)) {
        insertedNode = insertVideoOnSelection(sel, textProp, "youtube");
      }

      // Add GUIDs to inserted elements.
      if (insertedNode) {
        setElementGUID(insertedNode);
        // UL and OL inserted notes will also have a child li right away.
        // Make sure that all their children have guid set.
        if (["ul", "ol"].indexOf(insertedNode.nodeName.toLocaleLowerCase()) >= 0) {
          var lisChildren = insertedNode.getElementsByTagName('li');
          for (var i = 0; i < lisChildren.length; i++) {
            setElementGUID(lisChildren[i]);
          }
        }
      } else {
        // By default the enter key will copy whatever previous element it was
        // on with attributes and all. Make sure to set a new GUID to the element
        // if it has the same GUID in all.
        if (event.keyCode == 13 && sel.anchorNode)  {
          var currentNode = getGuidEnabledNode(sel.anchorNode);
          var currentId = currentNode.getAttribute(options.guidAttribute);
          var prevEl = currentNode.previousSibling;
          var prevId = prevEl ? prevEl.getAttribute(options.guidAttribute) : null;
          if (!currentId || currentId == prevId) {
            setElementGUID(currentNode);
          }
        }
      }

      unwrap = insertedNode &&
              ["ul", "ol"].indexOf(insertedNode.nodeName.toLocaleLowerCase()) >= 0 &&
              ["p", "div"].indexOf(insertedNode.parentNode.nodeName.toLocaleLowerCase()) >= 0;

      if (unwrap) {
        node = sel.anchorNode;
        parent = insertedNode.parentNode;
        parent.parentNode.insertBefore(insertedNode, parent);
        parent.parentNode.removeChild(parent);
        moveCursorToBeginningOfSelection(sel, node);
      }

      return insertedNode;
    }

    function moveCursorToBeginningOfSelection(selection, node) {
      var range = document.createRange();
      range.setStart(node, 0);
      range.setEnd(node, 0);
      selection.removeAllRanges();
      selection.addRange(range);
    }

    function triggerTextStyling(node) {
      var className = node.className,
          sel = window.getSelection(),
          selNode = sel.anchorNode,
          tagClass,
          reTag;

      for (var tag in tagClassMap) {
        tagClass = tagClassMap[tag];
        reTag = new RegExp(tagClass);

        if (reTag.test(className)) {
          switch(tag) {
            case "b":
              if (selNode && !hasParentWithTag(selNode, "h1") && !hasParentWithTag(selNode, "h2")) {
                document.execCommand(tagClass, false);
              }
              return;
            case "i":
              document.execCommand(tagClass, false);
              return;

            case "h1":
            case "h2":
            case "h3":
            case "blockquote":
            case "pre":
              toggleFormatBlock(tag);
              return;

            case "a":
              toggleUrlInput();
              optionsNode.className = "options url-mode";
              return;
          }
        }
      }

      triggerTextSelection();
    }

    function triggerUrlBlur(event) {
      var url = urlInput.value;

      optionsNode.className = "options";
      window.getSelection().addRange(previouslySelectedText);

      document.execCommand("unlink", false);

      if (url === "") {
        return false;
      }

      if (!url.match("^(http://|https://|mailto:)")) {
        url = "http://" + url;
      }

      if (options.openLinksInBlank) {
        var sText = window.getSelection();
        var linkHtml = '<a href="' + url + '" target="_blank">' + sText + '</a>';
        document.execCommand("insertHTML", false, linkHtml);
      } else {
        document.execCommand("createLink", false, url);
      }

      urlInput.value = "";
    }

    function triggerUrlSet(event) {
      if (event.keyCode === 13) {
        event.preventDefault();
        event.stopPropagation();

        urlInput.blur();
      }
    }

    function toggleFormatBlock(tag) {
      var appliedTag = tag;
      if (hasParentWithTag(getFocusNode(), tag)) {
        appliedTag = 'p';
        document.execCommand("formatBlock", false, "p");
        document.execCommand("outdent");
      } else {
        document.execCommand("formatBlock", false, tag);
      }
      var sel = window.getSelection();
      var element = getParentWithTag(sel.anchorNode, appliedTag);
      setElementGUID(element);
    }

    function toggleUrlInput() {
      setTimeout(function() {
        var url = getParentHref(getFocusNode());

        if (typeof url !== "undefined") {
          urlInput.value = url;
        } else {
          document.execCommand("createLink", false, "/");
        }

        previouslySelectedText = window.getSelection().getRangeAt(0);

        urlInput.focus();
      }, 150);
    }

    function getParent(node, condition, returnCallback) {
      if (node === null) {
        return;
      }

      while (node.parentNode) {
        if (condition(node)) {
          return returnCallback(node);
        }

        node = node.parentNode;
      }
    }

    function getParentWithTag(node, nodeType) {
      var checkNodeType = function(node) { return node.nodeName.toLowerCase() === nodeType; },
          returnNode = function(node) { return node; };

      return getParent(node, checkNodeType, returnNode);
    }

    function hasParentWithTag(node, nodeType) {
      return !!getParentWithTag(node, nodeType);
    }

    function getParentHref(node) {
      var checkHref = function(node) { return typeof node.href !== "undefined"; },
          returnHref = function(node) { return node.href; };

      return getParent(node, checkHref, returnHref);
    }

    function triggerTextSelection(e) {
      var selectedText = root.getSelection(),
          range,
          clientRectBounds,
          target = e.target || e.srcElement;

      // The selected text is not editable
      if (!target.isContentEditable || options.mode !== "rich") {
        reloadMenuState();
        return;
      }

      // The selected text is collapsed, push the menu out of the way
      if (selectedText.isCollapsed) {
        toggleSideMenu(e);
        setTextMenuPosition(EDGE, EDGE);
        textMenu.className = "text-menu hide";
      } else {
        range = selectedText.getRangeAt(0);
        clientRectBounds = range.getBoundingClientRect();

        // Every time we show the menu, reload the state
        reloadMenuState();
        setTextMenuPosition(
          clientRectBounds.top - 5 + root.pageYOffset,
          (clientRectBounds.left + clientRectBounds.right) / 2
        );
      }
    }

    function setTextMenuPosition(top, left) {
      // RTL Seems to have a problem with calculating the bounding client.
      if (options.rtl) {
        left += 200;
      }
      textMenu.style.top = top + "px";
      textMenu.style.left = left + "px";

      if (options.animate) {
        if (top === EDGE) {
          textMenu.className = "text-menu hide";
        } else {
          textMenu.className = "text-menu active";
        }
      }
    }

    function triggerContentFocus(e) {
      var el = e.target, wasPlaceholder;
      var p = el.getElementsByClassName('g-placeholder');
      var elHeight = 0;
      for (var i=0; i < p.length; i++) {
        if (elHeight < p[i].offsetHeight) {
          elHeight = p[i].offsetHeight;
        }
        el.removeChild(p[i]);
        wasPlaceholder = true;
        toggleFormatBlock("p");
      }

      if (wasPlaceholder) {
        el.style.minHeight = elHeight + 'px';
        if (isFirefox) {
          // Firefox needs this to focus the element.
          this.focus();
        } else {
          // A hack to get the element to focus.
          var range = document.createRange();
          range.selectNodeContents(this);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
     }

    function triggerContentBlur(e) {
      var el = e.target;
      var content = el[getTextProp(el)];
      if (!content.trim()) {
        addPlaceholder(el, options.placeholder);
      }
      // Unless the options are in url-mode. Hide the menu.
      if (optionsNode.className.search("url-mode") === -1) {
        setTextMenuPosition(EDGE, EDGE);
        textMenu.className = "text-menu hide";
      }
      hideSideMenu(e);
    }

    init(bindableNodes, userOpts);
  };

  // Exports and modularity
  if (typeof module !== 'undefined' && module.exports) {
      module.exports = Grande;
  }

  if (typeof ender === 'undefined') {
      this.Grande = Grande;
  }

  if (typeof define === "function" && define.amd) {
      define('Grande', [], function () {
          return Grande;
      });
  }

}).call(this, window, document);

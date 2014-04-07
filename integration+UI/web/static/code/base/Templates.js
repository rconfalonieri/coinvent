/* file: Templates.js 
Depends on: underscore, jQuery

WARNING: Templates in separate files can be sensitive to race conditions on when the different 
template files are loaded. Templates in one file MUST therefore NEVER refer to templates from 
another file. 

## Mods to Underscore

We use underscore.js templates, but with a couple of tweaks:

 - The input value (e.g. a SoDash data object) is always available as the 
 variable "context". Context is always set (even if there is no input value), 
 and always has a circular reference context.context = context.	
This (a) lets us to handle missing fields without undefined errors, 
and (b) lets us pass the item on to nested template calls.
 
 - Embedded javascript is via <script>...</script>, instead of <% ... %>
 (interpolation is unchanged as <%= %>).
 Important: We're using a simple regex which only matches exactly on "<script>"
 This enables syntax highlighting in the editor.
 Side effects: be careful if using templates to insert "static" 
 script blocks (but that's probably a bad idea anyway).

## Usage

Define your templates in an html file.
Write html like this in a separate file, e.g. MyTemplates.html:

	<template id='MyWidgetName'>
		<div class='MyWidgetName'>etc</div>
	</template>

Load it via: loadTemplates(url)

Use it via: 
$('.whatever).html( templates.MyWidgetName(item) );

There is ajaxify support for finding & filling in template calls from html of the form:

	<div class="FromTemplate" template="MyTemplateName" templateSrc="MyUrlForTemplateHtml"></div>

templateSrc is optional. If set, MyUrlForTemplateHtml will be loaded via loadTemplates()
*/
(function () {
	// Use script tags for embedded JavaScript.
	_.templateSettings = {
	  interpolate: /<%=([\s\S]+?)%>/g,
	  evaluate: /<script>([\s\S]+?)<\/script>/g
	};
	
	// A custom error for issues within templates.
	function TemplateError(name, error) {
		this.message = "Error while parsing '" + name + "' (" + error.toString () + ")";
	}
	
	TemplateError.prototype = new Error();
	
	TemplateError.prototype.name = "TemplateError";
	
	// Map of template file urls to the deferred returned by the request for that
	// template. Ensures that each template file is only requested once.
	var loadedTemplates = {};
	
	// Compiled templates are stored here, so as not to pollute the global namespace.
	window.templates = {};
	
	// Placeholder for storing functions that should be called by templates, 
	// so they don't need to pollute the global namespace.
	// TODO What is best-practice for defining such functions??
	window.templates.fn = {}; 
	
/**
 * Poke a SoDash item so it can serve as an underscore template context.
 * This lets context.property be used for potentially undefined properties.
 * This is called automatically for templates loaded via loadTemplates().
 * @param item Can be null
 * @returns item (modified) Never null
 * It is harmless to call this multiple times
**/
	var _templateContext = function (item) {
		if (!item) {
			item = {};
		}
		
		item.context = item;
		
		// Set (or reset) a property (Warning: modifies obj!) & return the obj
		// obj can be null, in which case a new object is created.
		// Typical use case: <%= templates.subTemplate(set(context.child, key, value)); %>
		// ?? promote this to a Utils function?
		item.set = function (obj, key, value) {
			if (!obj) {
				obj = {};
			}
			
			obj[key] = value;
			
			return obj;
		};
		
		return item;
	}

/**
 * Creates the function used to render a template. The function generated by
 * `_.template` is wrapped so that the returned function always provides the
 * template context in the `context` variable. Error reporting is also added,
 * so that templates which fail to render are reported to the server.
 * 
 * @param {String} contents - The contents of the template.
 * @param {String} [name] - The name of the template, used to report errors when
 * attempting to render the template.
 * @returns {Function} The customised template rendering function.
**/
	window.createTemplate = function (contents, name) {
		var tFn = _.template(contents);
		
		return function (data) {
			try {
				return tFn(_templateContext(data));
			} catch (err) {
				// The error caught while processing templates is not informative, so let's create one that is.
				reportError(new TemplateError(name, err));
			}
		};
	}

	/**
	 * Obtains the url to load templates from. If there are compiled templates being
	 * used, that url will be returned.
	 * 
	 * @param {String} originalUrl - The url to return if there is no compiled
	 * templates url available.
	 * @returns {String} The url from which to load the templates.
	**/
	var getTemplatesUrl = (function () {
		var hasAccessedDOM = false, // Only access the DOM once, and cache the result.
			fileUrl = null; // The retrieved url.
		
		// This is the function that is invoked when `getTemplatesUrl` is invoked.
		return function (originalUrl) {
			if (hasAccessedDOM) {
				if (fileUrl === null) {
					return originalUrl;
				} else {
					return fileUrl;
				};
			}
			
			// Only access the DOM once.
			hasAccessedDOM = true;
			
			fileUrl = getUrlFromDOM();
			
			// Call this function again to make use of the relevant url.
			return getTemplatesUrl(originalUrl);
		}
		
		// Tries to obtain the compiled templates url from the DOM. Checks the
		// 'html' element for the attribute 'data-compiled-templates', and if
		// found uses the url it contains.
		function getUrlFromDOM() {
			var htmlElement = document.getElementsByTagName('html'),
				i;
			
			// Try to obtain the lanaguage from the `data-compiled-templates` attribute on the html element.
			for (i = 0; i < htmlElement.length; i++) {
				urlFromDOM = htmlElement[i].getAttribute('data-compiled-templates');
				
				if (urlFromDOM) {
					return urlFromDOM;
				}
			}
			
			return null;
		}
	}());

/**
 * Use this to load-then-process templates.
 * 
 * @param {String} url The url from which the templates should be loaded.
 * @param {Function} [callback] The callback function to execute once the
 * templates have been loaded.
 * @returns A <a href="http://api.jquery.com/jQuery.ajax/#jqXHR">jqXHR object</a>.
 * It is resolved when the templates have been loaded and parsed.
**/
	window.loadTemplates = function (url, callback) {
		var templateRequest; // The deferred returned by the request for this template.
		
		console.log("templates","Loading from "+url+"...");
		
		if (loadedTemplates[url]) {
			// Use the previously cached request for this template.
			templateRequest = loadedTemplates[url];
			
			console.log('Templates already requested from file url(' + url + '). Adding callback.');
		} else {
			// Create a new request for the templates at the supplied url.
			templateRequest = createTemplateRequest(url, callback);
			
			// Cache the request for this url.
			loadedTemplates[url] = templateRequest;
		}
		
		// If a callback was supplied, invoke it upon resolution of the request.
		if (typeof callback === 'function') {
			templateRequest.done(function () {
				$(callback); // Don't invoke until the DOM is ready.
			});
		}
		
		templateRequest.done(function (parsedTemplates) {
			var templateName;
			
			for (templateName in parsedTemplates) {
				if (parsedTemplates.hasOwnProperty(templateName)) {
					$(function () {
						ajaxifyFromTemplate(parsedTemplates[templateName], templateName);
					});
				}
			}
		});
		
		return templateRequest;
	};
	
/**
 * Creates an AJAX request to load templates from the supplied url. If a callback
 * is supplied, it is invoked when the request is successfully resolved.
 * 
 * @param {String} url - The url from which the templates should be loaded.
 * @param {Function} callback - Callback that should be invoked on success.
 * @returns A http://api.jquery.com/category/deferred-object/ object. Callbacks
 * that are invoked when the object is resolved should accept one argument, a
 * map of templates obtained at the supplied url, by name.
**/
	function createTemplateRequest(url, callback) {
		return $.ajax({
			url: url,
			dataType:'html'	
		}).then(function (result) {		
			var parsedTemplates;
			
			console.log("templates","...Loaded from " + url);
			
			assert(result, 'No content found in templates file at [' + url + ']');
			
			parsedTemplates = parseTemplates(result);
			
			return $.Deferred().resolve(parsedTemplates);
		});
	}
	
/**
 * Extracts template functions from a file of html templates. The RegExp
 * `templateMatcher` has two capturing groups: the first is the name of the
 * template, and the second is the html contents of the template.
 * 
 * @param {String} templatesHtml - The html for one or more templates.
 * @returns {Object} A map of the extracted templates, by name.
**/
	window.parseTemplates = function (templatesHtml) {
		var templateMatcher = /<template\s+id=['"](.+?)['"]\s*>([\s\S]*?)<\/template>/gm,
			matchedTemplate,
			parsedTemplates = {};
		
		// Strip whitespace (but not spaces) from between closing and opening tags.
		templatesHtml = templatesHtml.replace(/>[\t\n]*</g, '><');
		
		// Match the html of templates in the supplied file, and return 
		while ((matchedTemplate = templateMatcher.exec(templatesHtml))) {
			parsedTemplates[matchedTemplate[1]] = parseTemplate(matchedTemplate[1], matchedTemplate[2]);
		}
		
		return parsedTemplates;
	}
	
/**
 * Parses the name and html content of a template, generating a global template
 * function for that template, and tries to invoke and ajaxified forms of this
 * template.
 * 
 * @param {String} templateName - The name of this template.
 * @param {String} templateHtml - The html content of this template.
 * @returns {Function} The invokable form of this template.
**/
	function parseTemplate(templateName, templateHtml) {
		assert(templateName, 'Template has no name');
		
		// assert(templateHtml, 'Template [' + templateName + '] has no content');
		// Trim any whitespace
		templateHtml = templateHtml.trim();
		templateFunction = createTemplate(templateHtml, templateName);
		
		if (window.templates[templateName]) {
			console.warn('Overwriting template [' + templateName + ']');
		}
		
		window.templates[templateName] = templateFunction;
		
		return templateFunction;
	}
	
	/** Check each template for un-ajaxed divs.
	Handles ajax loading of FromTemplate divs. */
	window.ajaxifyFromTemplates = function () {
		// Load some?
		var elems = $('div.FromTemplate').not(".ajaxed");
		elems.each(function() {
			var elem = $(this);		
			var src = elem.attr('templateSrc');
			if (src) {
				loadTemplates(src);
			}
		});
		// Apply loaded templates to un-ajaxed divs
		for(var tName in templates) {
			var template = templates[tName];
			ajaxifyFromTemplate(template, tName);
		}

		$(document).trigger("FromTemplates:done");
	}
	
	function ajaxifyFromTemplate(template, tName) {
		assert(template, tName);
		//console.log("templates","Ajaxify "+tName);
		// Get elements using this template which are not ajaxed
		// This is where the "FromTemplate" divs get expanded
		var elems = $('[template="' + tName + '"]').not(".ajaxed");
		//console.log("templates", tName, "Found "+elems.length);
		// 				
		elems.each(function() {
			var elem = $(this);
			//console.log("templates","...Applying "+tName, elem);
			var cntxt = {};				
			var tContext = elem.attr('context');
			if (tContext) {
				try {
					cntxt = JSON.parse(tContext);
				} catch (e) {
					reportError(new Error('Unable to parse context JSON for template "' + tName + '" (' + e.toString() + ')'));
				
					return;
				}
			}

			var h = template(cntxt);

			elem.html(h);

			elem.addClass('ajaxed');
		});
	}
	
	// SoDash cruft: apply to late-loading html
	if (window.ajaxifyFunctions) {
		console.log("registering ajaxify templates...");
		ajaxifyFunctions.push(ajaxifyFromTemplates);
	}
	
	$(ajaxifyFromTemplates);
	
	// setup a simple logging template -- it spits the context into the html as a comment
	// E.g. usage: <%=templates.log(context)%>
	// NB: Why not JSON.stringify? because we may have circular data structures.
	parseTemplates("<template id='log'><script>print('<!-- '+(printer? printer.str(context, [], 1).replace(/(<!--|-->)/g,''): '')+'-->');</script></template>");
}());

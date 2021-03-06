/* 	file: CoinventClient.js 
	author: Daniel Winterstein 
	depends on: jQuery, SJTest.js
*/
/* ----------------- DATA TYPES -------------- */


/**
 * @param jsonObject {object|BlendDiagram?} Optional source for properties (will perform a copy). 
 */
function BlendDiagram(jsonObject) {
	this.format = 'owl';
	/** {Concept} */
	this.base = new Concept(jsonObject? jsonObject.base : null);
	/** {Concept} */
	this.blend = new Concept(jsonObject? jsonObject.blend : null);
	/** {Concept} */
	this.input1 = new Concept(jsonObject? jsonObject.input1 : null);
	/** {Concept} */
	this.input2 = new Concept(jsonObject? jsonObject.input2 : null);

	/** {object} */
	this.base_input1=jsonObject? jsonObject.base_input1 || {} : {};
	this.base_input2=jsonObject? jsonObject.base_input2 || {} : {};
	this.input1_blend=jsonObject? jsonObject.input1_blend || {} : {};
	this.input2_blend=jsonObject? jsonObject.input2_blend || {} : {};
//	If weakenings are used, then these Concepts are names weakinput1, weakinput2, and weakbase, 
}

function Concept(text) {
	if (match(text,String)) {
		this.format = 'owl';
		this.text = text;
		/** {string} */
		this.url = null;
	} else if (text) {
		this.format = text.format;
		this.text = text.text;
		/** {string} */
		this.url = text.url;
	}
	/** {String[]?} Names for the symbols used in this Concept. */
	this.symbols = null;
	/** {String?} url for an image illustrating this Concept. */
	this.img = null;
	/** {Issue[]} */
	this.issues = [];
}

/** TODO an Issue is a proof-obligation, or even an inconsistency -- something calling for action. */
function Issue(text, sentences) {
	/** {String} */
	this.text = text;
	/** {Sentence[]?} */
	this.sentences = sentences;
}

/** TODO represent a slice of a text, e.g. one line */
function Sentence(base) {
	this.base = base;
}


/* -------------------- COINVENT CLIENT ----------------------*/


/**
* @param server {string?} The url for the server
*/
function CoinventClient(server) {
	/** {string} The url for the server -- always ends with a '/'.
	*/
	this.server = server || '/';
	if (this.server.charAt(this.server.length-1)!='/') this.server += '/';
	/**
	 * op-to-actor_name, e.g. engines.blend = 'hets'.	 
	 * Blanks will be filled in with "default".
	 * Can be set to a String instead, in which case one value is used for all operations.
	 */
	this.engines = {};

	/**
	* {boolean} If true, where BlendDiagrams are passed into a function, they will be modified by the
	* result on success. The default (false) is that the user handles what to do with the ajax response.
	*/
	this.editInPlace = false;
}

// TODO enum
//CoinventClient.STATUS = 

/** common basis for posts */
CoinventClient.prototype.postBlendDiagram = function(op, blendDiagram) {
	assertMatch(op,String, blendDiagram,BlendDiagram);
	var engine = match(this.engines,String)? this.engines : this.engines[op] || 'default';
	var data = {
			lang: blendDiagram.format,
			input1: this.val(blendDiagram.input1),
			input2: this.val(blendDiagram.input2),
			base: this.val(blendDiagram.base),
			base_input1: blendDiagram.base_input1,
			base_input2: blendDiagram.base_input2
			//cursor: {?url} For requesting follow-on results.
		};
	var xhr = $.ajax({
		url: this.server+op+'/'+engine,
		type:'POST',
		data: data
	});
	if (this.editInPlace) {
		xhr.then(function(r) {
			var newBD = new BlendDiagram(r.cargo);
			var old = JSON.stringify(blendDiagram);
			$.map(newBD, function( value, key ) {
				blendDiagram[key] = value;
				return key;
			});
			console.log("mod", old, blendDiagram);
		});
	}
	return xhr;
};

/** common basis for posts */
CoinventClient.prototype.postConcept = function(op, concept) {
	assertMatch(op,String, concept,Concept);
	var data = {
			lang: concept.format,
			concept: this.val(concept),
			//cursor: {?url} For requesting follow-on results.
		};
	var engine = match(this.engines,String)? this.engines : this.engines[op] || 'default';
	return $.ajax({
		url: this.server+op+'/'+engine,
		type:'POST',
		data: data
	});
};

/**
 * Given 2 Concepts, compute a common base Concept
 * @param blendDiagram {BlendDiagram}
 */
CoinventClient.prototype.base = function(blendDiagram) {
	return this.postBlendDiagram('base', blendDiagram);
};


/**
 * Given 2 Concepts and a base, compute a blend Concept
 * @param blendDiagram {BlendDiagram}
 */
CoinventClient.prototype.blend = function(blendDiagram) {
	return this.postBlendDiagram('blend', blendDiagram);
};

/**
 */
CoinventClient.prototype.model = function(concept) {
	return this.postConcept('model', concept);
};

/**
 */
CoinventClient.prototype.consistency = function(concept) {
	return this.postConcept('consistency', concept);
};
/**
 */
CoinventClient.prototype.quality = function(concept) {
	return this.postConcept('quality', concept);
};
/**
 */
CoinventClient.prototype.weaken = function(blendDiagram) {
	return this.postConcept('weaken', blendDiagram);
};

/**
 * @param pathToFile e.g. "project-foo/mytheory.dol"
 */
CoinventClient.prototype.file_load = function(actor, pathToFile) {
	assertMatch(actor, String, pathToFile, String);
	return $.ajax({
		url: this.server+'file/'+actor+'/'+pathToFile
	});
}
/**
 * @param pathToFile e.g. "winterstein/mytheory.dol"
 */
CoinventClient.prototype.file_save = function(actor, pathToFile, text) {
	assertMatch(actor, String, pathToFile, String, text, String);
	return $.ajax({
		url: this.server+'file/'+actor+'/'+pathToFile+"?action=save",
		type:'POST',
		data: text
	});
}

/**
 * List the jobs for this actor
 */
CoinventClient.prototype.job_list = function(actor) {
	return $.ajax({
		url: this.server+'job/'+actor
	});
};
/**
 * Information on a job.
 */
CoinventClient.prototype.job_details = function(actor, jobId) {
	assertMatch(actor, String, jobId,String);
	return $.ajax({
		url: this.server+'job/'+actor+'/'+jobId
	});
};
/**
 * Save the result of a job
 */
CoinventClient.prototype.job_put = function(actor, jobId, result) {
	assertMatch(actor, String, jobId,String, result,String);
	return $.ajax({		
		url: this.server+'job/'+actor+'/'+jobId+'?action=put',
		type:'POST',
		data: {result:JSON.stringify(result)}
	});
}


function isURL(u) {
	if ( ! u || ! match(u, String)) return false;
	if (u.match(/\s/)) return false;
	// TODO better -- use a regex
	if (u.substring(0,4)==='http') return true;
	if (u.substring(0,1)==='/') return true;
	return false;
}

/** @returns value to send in an API request -- prefers url if set */
CoinventClient.prototype.val = function(concept) {
	if ( ! concept) return null;
	// is it a url?
	if (isURL(concept)) {
		return concept;
	}
	return concept.url || concept.text;
}



// helpful error logging
$(document).ajaxError(function( event, jqxhr, settings, thrownError ) {
	console.warn("ajax", settings.url, jqxhr.statusText);
});

// NB: Mappings are just json maps

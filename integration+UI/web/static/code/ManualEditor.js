
var BD;

function ManualEditor() {
	this.setModel(new BlendDiagram());
	this.client = new CoinventClient();
}

ManualEditor.prototype.setModel = function(bd) {
	if ( ! match(bd, BlendDiagram)) {
		bd = new BlendDiagram(bd);
	}
	this.model = bd;
	BD = this.model;

	this.setConcept('A', this.model.input1);
	this.setConcept('B', this.model.input2);
	this.setConcept('Base', this.model.base);
	this.setConcept('Blend', this.model.blend);
	this.setMapping('Base', 'A', this.model.base_input1);
	this.setMapping('Base', 'B', this.model.base_input2);
	this.setMapping('A', 'Blend', this.model.input1_blend);
	this.setMapping('B', 'Blend', this.model.input2_blend);
	// TODO mappings
};

ManualEditor.prototype.setConcept = function(targetName, concept) {
	assertMatch(concept, Concept);
	if (targetName==='Blend' || targetName==='blend') {
		this.model.blend = concept;
	} else if (targetName==='A' || targetName==='input1') {
		this.model.input1 = concept;
	} else if (targetName==='B' || targetName==='input2') {
		this.model.input2 = concept;
	} else if (targetName==='Base' || targetName==='base') {
		this.model.base = concept;
	}
	// Adjust the view (yes it would be nice if they auto-adjusted)
	$ed = $('#ManualTheoryEditor-'+targetName);
	assert($ed);
	$ed.data('concept',concept);
	$('span[data-bind=url]',$ed).text(concept.url);
	$('textarea', $ed).val(concept.text);
//	var rows = Math.max(4, Math.min(20, theory.trim().split(/\n/g).length))
//	$('textarea', $ed).attr('rows', rows);
	jsPlumb.repaintEverything();	
};


ManualEditor.prototype.setMapping = function(fromName, toName, mapping) {
	assertMatch(fromName, String, toName, String);
	// Adjust the view (yes it would be nice if they auto-adjusted)
	$ed = $('#ManualMappingEditor-'+fromName+'-'+toName);
	$ul = $('ul', $ed);
	assert($ed);
	$ed.data('mapping',mapping);
	var keys = _.keys(mapping);
	for(var i=0; i<keys.length; i++) {
		$ul.append("<li>"+keys[i]+" &rightarrow; "+mapping[keys[i]]+"</li>");
	}
//	var rows = Math.max(4, Math.min(20, theory.trim().split(/\n/g).length))
//	$('textarea', $ed).attr('rows', rows);
	jsPlumb.repaintEverything();	
};

ManualEditor.prototype.wireup = function() {
	var editor = this;
	
	// Base Button	
	$('button#FindBase').click(function() {
		var model = new BlendDiagram(editor.model);
		model.base = null; model.base_input1 = null; model.base_input2 = null;
		editor.client.base(model)
		.then(function(result){
			console.log("Yeh base", result);
			if (result.status === 'WAITING') {
				toastr.info("Find-base job posted. Waiting on "+editor.client.engines['base']+"...");
				return;
			} else if (result.status === 'DONE') {
				toastr.info("Common base found by "+editor.client.engines['base']);
				editor.setModel(result.cargo);
			}
		})
		.fail(function(err){
			console.log(err);
			toastr.error(JSON.stringify(err));
		});
	}); // ./FindBase.click()
	
	// Blend Button	
	$('button#FindBlend').click(function() {
		editor.client.blend(editor.model)
		.then(function(result){
			console.log("Yeh blend", result);			
			if (result.status === 'WAITING') {
				toastr.info("Find-blend job posted. Waiting on "+editor.client.engines['blend']+"...");
				return;
			} else if (result.status === 'DONE') {
				toastr.info("Blend found by "+editor.client.engines['blend']);
				editor.setModel(result.cargo);
			}
		})
		.fail(function(err){			
			console.log(err);
			toastr.error(JSON.stringify(err));
		});
	}); // ./FindBase.click()
	
	// Load Dialog
	$('#LoadModal button.Load').click(function() {
		var modal = $('#LoadModal');
		var url = $('input[name=url]',modal).val();
		console.log('value', url);
		var target = modal.data('loadTarget');
		console.log('target', target);
		// do the load
		$.ajax({url:url})
		.then(function(theory){
			console.log('loaded',target,theory);
			// Adjust the model
			var concept = new Concept(theory);
			concept.url = url;
			editor.setConcept(target, concept);
			// close
			$('#LoadModal').modal('hide');
			toastr.info("Loaded: "+target+" = "+url);
		})
		.fail(function(err){
			console.log("fail", err);
			toastr.error(JSON.stringify(err));
			$('#LoadModal AlertHolder').html('<div class="alert alert-danger" role="alert">'+JSON.stringify(err)+'</div>');
		});		
	}); // ./button.Load.click()
	
	// on-change for the editors
	$('.Theory textarea').change(function(event){
		console.log("change", event);
		var ta = event.target;
		var $ed = $(ta).parents('.Theory');
		assert($ed.length);
		console.log($ed.attr('id'), $ed);
		var concept = $ed.data('concept');
		assertMatch(concept,Concept);
		concept.text = $(ta).val();
	});
	
	// FLowchart Lines
	jsPlumb.ready(function() {
		jsPlumb.setContainer($("body"));
		
		// this is the paint style for the connecting lines..
		var paintStyle = {strokeStyle:"#669",lineWidth:4};
		var endpointStyle = {fillStyle:"#669", radius:5 };

		// Top
		jsPlumb.connect({
			    source: $('#ManualTheoryEditor-Blend'),			
			    target: $('#ManualModelEditor'),
			    anchors: [ "Top", "Bottom" ],
			    connector:[ "Flowchart" ],
			    paintStyle:paintStyle,
			    endpointStyle:endpointStyle
		});
		jsPlumb.connect({
			    source: $('#ManualMappingEditor-A-Blend'),
			    target: $('#ManualTheoryEditor-Blend'),
			    anchors: [ "Top", [0.25, 1, 0, 1] ],
			    connector:[ "Flowchart" ],
				paintStyle:paintStyle,
			    endpointStyle:endpointStyle
		});
		jsPlumb.connect({
		    source: $('#ManualMappingEditor-B-Blend'),
		    target: $('#ManualTheoryEditor-Blend'),
		    anchors: [ "Top", [0.75, 1, 0, 1] ],
		    connector:[ "Flowchart" ],
			    paintStyle:paintStyle,
			    endpointStyle:endpointStyle		    
		});
		
		jsPlumb.connect({
		    target: $('#ManualMappingEditor-A-Blend'),
		    source: $('#ManualTheoryEditor-A'),
		    anchors: [ "Top", "Bottom" ],
		    connector:[ "Flowchart" ],
			    paintStyle:paintStyle,
			    endpointStyle:endpointStyle		    
		});
		jsPlumb.connect({
		    target: $('#ManualMappingEditor-B-Blend'),
		    source: $('#ManualTheoryEditor-B'),
		    anchors: [ "Top", "Bottom" ],
		    connector:[ "Flowchart" ],
			    paintStyle:paintStyle,
			    endpointStyle:endpointStyle		    
		});
		
		
		// Bottom
		jsPlumb.connect({
		    source: $('#ManualMappingEditor-Base-A'),
		    target: $('#ManualTheoryEditor-A'),
		    anchors: [ "Top", "Bottom" ],
		    connector:[ "Flowchart" ],
			    paintStyle:paintStyle,
			    endpointStyle:endpointStyle
		});	
		jsPlumb.connect({
		    source: $('#ManualMappingEditor-Base-B'),
		    target: $('#ManualTheoryEditor-B'),
		    anchors: [ "Top", "Bottom" ],
		    connector:[ "Flowchart" ],
			    paintStyle:paintStyle,
			    endpointStyle:endpointStyle		    
		});	

		jsPlumb.connect({
		    target: $('#ManualMappingEditor-Base-A'),
		    source: $('#ManualTheoryEditor-Base'),
		    anchors: [ "Top", "Bottom" ],
		    connector:[ "Flowchart" ],
		    endpointStyle:endpointStyle,
		    paintStyle:paintStyle
		});	
		jsPlumb.connect({
		    target: $('#ManualMappingEditor-Base-B'),
		    source: $('#ManualTheoryEditor-Base'),
		    anchors: [ "Top", "Bottom" ],
		    connector:[ "Flowchart" ],
			    paintStyle:paintStyle,
			    endpointStyle:endpointStyle		    
		});	
		
	});/* ./ready */
	
	// Settings
	$('input.engine').each(function(){
		assert(editor);
		var name = $(this).attr('name');
		var op = name.substring(0, name.length - 6);
		assert(op);
		$(this).val(editor.client.engines[op] || 'default');
		$(this).change(function(v) {
			assert(editor);
			assert(op);
			assertMatch(editor.client, CoinventClient);
			console.log('editor.client',editor.client);
			editor.client.engines[op] = $(this).val();
			toastr.info(op+" engine is now: "+editor.client.engines[op]);
		});
	});


	// BUGGER -- no local copy
	if ( ! window.toastr) {
		window.toastr = {};
		window.toastr.info = function(m){console.log(m);};
		window.toastr.warning = function(m){console.log(m);};
		window.toastr.error = function(m){console.log(m);};
	}
	
}; /* ./wireup */

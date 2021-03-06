/** file: CHimeraEditor.js The code behind the CHimera Editor */

/** Let's make the blend-diagram easy to accesss for debugging */
var BD;

/** These names match up with the animals the server knows about.
TODO it'd be nice if we had an index-of-concepts */
var animals = [
	{name:'Meerkat', img:'/static/img/animals/meerkat.png'},
	{name:'Elephant', img:'/static/img/animals/elephant.png'},
	// {name:'Zebra', img:'/static/img/animals/zebra.png'},
	// {name:'Hippo', img:'/static/img/animals/hippo.png'},
	{name:'Porcupine', img:'/static/img/animals/porcupine.png'},
	{name:'Lion', img:'/static/img/animals/lion.png'},
	{name:'Mandrill', img:'/static/img/animals/mandrill.png'}
];

function ChimeraEditor() {
	this.setModel(new BlendDiagram());
	this.client = new CoinventClient();
	this.client.editInPlace = true;
	this.client.engines = 'chimera';
}

ChimeraEditor.prototype.setModel = function(bd) {
	if ( ! match(bd, BlendDiagram)) {
		bd = new BlendDiagram(bd);
	}
	this.model = bd;
	BD = this.model;
};

ChimeraEditor.prototype.wireup = function() {
	var editor = this;	
	$('.UI-title').text('Chimera Blender');

	$('#BlendButton').click(function() {
		// Set the model to point to the selected animals
		var activeA = $('#ChimeraTheoryEditor-A div.active[data-animal]');
		var animalA = activeA.attr('data-animal');
		editor.model.input1 = '/file/chimera/animals.csv?'+(animalA.toLowerCase());
		var activeB = $('#ChimeraTheoryEditor-B div.active[data-animal]');
		var animalB = activeB.attr('data-animal');
		editor.model.input2 = '/file/chimera/animals.csv?'+(animalB.toLowerCase());
		// blend 
		// Normally you would do weaken then blend, e.g. client.weaken(model).then(function(){client.blend(model)});
		// But the ChimeraActor is a right old hack which does both in one step.
		editor.client.blend(editor.model)
			.then(function(a) {
				var bsrc = $('#ChimeraTheoryEditor-B div.active img').attr('src');
				var asrc = $('#ChimeraTheoryEditor-A div.active img').attr('src');
				toastr.info("Blended!");
				console.log("Blended", a);
				$('.chimera-img .animal-head').css('background-image', "url('"+asrc+"')");	
				$('.chimera-img .animal-body').css('background-image', "url('"+bsrc+"')");
				// HACK The chimera backend is going to send back json for convenience
				var chimeraObj = JSON.parse(editor.model.blend.text);	
				if (chimeraObj.name) $('.chimera-name').text(chimeraObj.name);
				// splat out the text values
				var keys = _.keys(chimeraObj);
				var text = "";
				for(var ki=0;ki<keys.length;ki++) {
					var vali = chimeraObj[keys[ki]];
					text += vali+" ";
				}
				$('.chimera-desc').text(text);	
			})
			.fail(function(e){
				toastr.warning(e);
			});
	}); /* ./BlendButton */

	// model
	$('#ModelButton').click(function() {
		editor.client.model(editor.model.blend)
			.then(function(r){
				toastr.info("Modelled!");
				console.log("Model", r.cargo);	
				var m = r.cargo.models[0];
				$('#ChimeraModelView').replaceWith(templates.ChimeraModelView(m));	
				// $().scrollTo($('#ChimeraModelView'),500);
			})
			.fail(function(e){
				toastr.warning(e);
			});
	}); /* ./ModelButton */

}; /* ./wireup */

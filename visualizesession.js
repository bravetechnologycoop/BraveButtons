var socket = io.connect('https://chatbot.brave.coop/', {secure: true});

socket.on('stateupdate', function (state) {

	function decamelize(str){
	return str
        .replace(/([a-z\d])([A-Z])/g, '$1' + ' ' + '$2')
        .replace(/([A-Z]+)([A-Z][a-z\d]+)/g, '$1' + ' ' + '$2')
        .replace(/\b\w/g, function(l){ return l.toUpperCase() });
    }

    function setTable(data) {

    	let table = document.getElementById('session-table');
    	let newTable = '';

    	if(Object.keys(data).length > 0) {
    		let templateSession = data[Object.keys(data)[0]];
    		newTable += '<thead><tr>';
    		Object.keys(templateSession).forEach((field) => {
    			console.log(field);
    			newTable += '<th scope="col">' + decamelize(field) + '</th>';
    		});
    		newTable += '</tr></thead>';
    	}

    	newTable += '<tbody>';
    	for (let key in data) {
    		const session = data[key];
    		console.log(session);
    		newTable += '<tr>';
    		for (let field in session) {
    			const val = session[field];
    			console.log(field);
    			newTable += '<td>' + val + '</td>';
    		}
    		newTable += '</tr>';
    	}
    	newTable += '</tbody>';
    	console.log(newTable);
    	table.innerHTML = newTable;
    }
    setTable(state);

 });


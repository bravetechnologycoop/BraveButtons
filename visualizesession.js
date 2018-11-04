var socket = io.connect('https://8779b162.ngrok.io/', {secure: true});

socket.on('stateupdate', function (state) {

    function setTable(data) {

    	let table = document.getElementById('session-table');
    	let newTable = '';

    	if(Object.keys(data).length > 0) {
    		let templateSession = data[Object.keys(data)[0]];
    		newTable += '<thead><tr>';
    		Object.keys(templateSession).forEach((field) => {
    			console.log(field);
    			newTable += '<th scope="col">' + field + '</th>';
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


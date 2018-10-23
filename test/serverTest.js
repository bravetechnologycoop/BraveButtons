let nock = require('nock');
let chai = require('chai');
let app = require('../server.js');
let chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;

describe('Chatbot server', () => {
	let baseUrl = "https://chatbot.brave.coop";

	let defaultBody = {
		'Unit': '123',
		'UUID': '111'
	};

	let defaultBody2 = {
		'Unit': '222',
		'UUID': '222'
	};

	describe('POST request', () => {
		it('should return ok to a valid request', async () => {
			let response = await chai.request(app).post('/') .send(defaultBody);
			expect(response).to.have.status(200);
		});

	    it('should return 400 to a request with an empty body', async () => {
			let response = await chai.request(app).post('/') .send({});
			expect(response).to.have.status(400);
		});

		it('should return 400 to a request with an incomplete body', async () => {
			let response = await chai.request(app).post('/') .send({'Unit': '400'});
			expect(response).to.have.status(400);
		});
	});
});
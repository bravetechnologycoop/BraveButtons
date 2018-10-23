let nock = require('nock');
let chai = require('chai');
let chaiHttp = require('chai-http');
chai.use(chaiHttp);
const expect = chai.expect;

describe('Chatbot server', () => {
	let baseUrl = "https://chatbot.brave.coop";

	let defaultBody = {
		'Unit': '123',
		'UUID': '111'
	};

	describe('POST request', () => {
		it('should return ok to a valid request', async () => {
			let response = await chai.request(baseUrl).post('/') .send(defaultBody);
			expect(response).to.have.status(200);
		});
	});
});
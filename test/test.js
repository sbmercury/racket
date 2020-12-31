const request = require('supertest');
const app = require('../server.js');
 
describe('GET /', function() {
  it('check for 200 reponse code', function(done) {
    request(app)
		.get('/')
        .expect('Content-Type', 'text/html; charset=UTF-8')
		.expect(200, done);
  });
});

describe('GET /api/new_reimbursement', function() {
    it("returns a 418 with missing values", function(done) {
        request(app)
            .post('/api/new_reimbursement')
            .expect(418, done);
    });
})

describe('GET /api/close_reimbursement', function() {
    it("returns a 418 with missing values", function(done) {
        request(app)
            .post('/api/close_reimbursement')
            .expect(418, done);
    });
})
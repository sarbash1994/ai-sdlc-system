const request = require('supertest');
const app = require('../src/app');

describe('POST /api/language/validate', () => {
  it('should return detected languages for title and description', async () => {
    const res = await request(app)
      .post('/api/language/validate')
      .send({
        title: 'Fix bug in login',
        description: 'Исправить ошибку в логине'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('titleLanguage', 'English');
    expect(res.body).toHaveProperty('descriptionLanguage', 'Russian');
  });

  it('should return 400 if title or description is missing or not string', async () => {
    const res = await request(app)
      .post('/api/language/validate')
      .send({ title: 123, description: null });

    expect(res.statusCode).toBe(400);
    expect(res.body).toHaveProperty('error');
  });
});

const jwtDecode = require('jsonwebtoken/decode');
const { Issuer, Strategy: OpenIDStrategy } = require('openid-client');
const setupOpenId = require('./openidStrategy');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

// Mock the cache
jest.mock('~/cache/getLogStores', () => {
  return jest.fn().mockReturnValue({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  });
});

jest.mock('jsonwebtoken/decode');
jest.mock('openid-client');

jest.mock('~/server/services/Files/strategies', () => ({
  getStrategyFunctions: jest.fn(() => ({
    saveBuffer: jest.fn(),
  })),
}));

Issuer.discover = jest.fn().mockResolvedValue({
  Client: jest.fn(),
});

jwtDecode.mockReturnValue({
  roles: ['requiredRole'],
});

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('setupOpenId', () => {
  const OLD_ENV = process.env;
  describe('OpenIDStrategy', () => {
    let validateFn;

    beforeAll(async () => {
      //call setup so we can grab a reference to the validate function
      await setupOpenId();
      validateFn = OpenIDStrategy.mock.calls[0][1];
    });

    afterAll(async () => {
      process.env = OLD_ENV;
    });

    beforeEach(() => {
      jest.clearAllMocks();
      process.env = {
        ...process.env,
        OPENID_ISSUER: 'https://fake-issuer.com',
        OPENID_CLIENT_ID: 'fake_client_id',
        OPENID_CLIENT_SECRET: 'fake_client_secret',
        DOMAIN_SERVER: 'https://example.com',
        OPENID_CALLBACK_URL: '/callback',
        OPENID_SCOPE: 'openid profile email',
        OPENID_REQUIRED_ROLE: 'requiredRole',
        OPENID_REQUIRED_ROLE_PARAMETER_PATH: 'roles',
        OPENID_REQUIRED_ROLE_TOKEN_KIND: 'id',
      };
    });

    const tokenset = {
      id_token: 'fake_id_token',
    };

    const userinfo = {
      sub: '1234',
      email: 'test@example.com',
      email_verified: true,
      given_name: 'First',
      family_name: 'Last',
      name: 'My Full',
      username: 'flast',
    };

    it('should set username correctly for a new user when username claim exists', async () => {
      console.log('Mongoose connection state is: ' + mongoose.connection.readyState);

      const userSchema = require('~/models/schema/userSchema');
      const u2 = mongoose.model('User', userSchema);
      let u = await u2.findOne({ openidId: 1 });
      console.log('Find user should return null: ' + u);

      validateFn(tokenset, userinfo, (err, user) => {
        expect(err).toBe(null);
        expect(user.username).toBe(userinfo.username);
      });
    });
    /*
    it('should set username correctly for a new user when given_name claim exists, but username does not', async () => {
      let userinfo_modified = { ...userinfo };
      delete userinfo_modified.username;

      validateFn(tokenset, userinfo_modified, (err, user) => {
        expect(err).toBe(null);
        expect(user.username).toBe(userinfo.given_name);
      });
    });

    it('should set username correctly for a new user when email claim exists, but username and given_name do not', async () => {
      let userinfo_modified = { ...userinfo };
      delete userinfo_modified.username;
      delete userinfo_modified.given_name;

      validateFn(tokenset, userinfo_modified, (err, user) => {
        expect(err).toBe(null);
        expect(user.username).toBe(userinfo.email);
      });
    });

    it('should set username correctly for a new user when using OPENID_USERNAME_CLAIM', async () => {
      process.env.OPENID_USERNAME_CLAIM = 'sub';

      validateFn(tokenset, userinfo, (err, user) => {
        expect(err).toBe(null);
        expect(user.username).toBe(userinfo.sub);
      });
    });

    it('should set name correctly for a new user with first and last names', async () => {
      validateFn(tokenset, userinfo, (err, user) => {
        expect(err).toBe(null);
        expect(user.name).toBe(userinfo.given_name + ' ' + userinfo.family_name);
      });
    });

    it('should set name correctly for a new user using OPENID_NAME_CLAIM', async () => {
      process.env.OPENID_NAME_CLAIM = 'name';
      let userinfo_modified = { ...userinfo, name: 'Custom Name' };

      validateFn(tokenset, userinfo_modified, (err, user) => {
        expect(err).toBe(null);
        expect(user.name).toBe(userinfo_modified.name);
      });
    });
*/
  });
});
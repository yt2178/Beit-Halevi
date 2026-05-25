module.exports = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ['./jest.setup.js'],
  transform: {
    '^.+\\.jsx?$': 'babel-jest',
  },
};

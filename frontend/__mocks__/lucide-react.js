const React = require('react');

const MockIcon = ({ className }) => React.createElement('svg', { className, 'data-testid': 'mock-icon' });

module.exports = new Proxy({}, {
  get: function(target, prop) {
    if (prop === '__esModule') return true;
    return MockIcon;
  }
});

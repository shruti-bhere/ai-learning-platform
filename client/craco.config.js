module.exports = {
  devServer: (devServerConfig) => {
    // Remove deprecated options to fix webpack-dev-server warnings
    // These are set by react-scripts internally, but we can remove them
    // The actual middleware setup is handled by react-scripts via setupMiddlewares
    delete devServerConfig.onBeforeSetupMiddleware;
    delete devServerConfig.onAfterSetupMiddleware;
    
    return devServerConfig;
  },
};


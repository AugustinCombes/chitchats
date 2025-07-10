export default ({ config }) => {
  const basePath = process.env.EXPO_PUBLIC_BASE_PATH || '/';
  
  return {
    ...config,
    experiments: {
      ...config.experiments,
      baseUrl: basePath
    },
    extra: {
      ...config.extra,
      basePath: basePath
    }
  };
};
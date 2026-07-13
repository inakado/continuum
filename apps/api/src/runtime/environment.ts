export const isProductionEnvironment = () => {
  const environment = process.env.NODE_ENV || process.env.APP_ENV || '';
  return environment.toLowerCase() === 'production';
};

export const shouldRegisterDebugControllers = () => !isProductionEnvironment();

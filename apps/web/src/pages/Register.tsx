import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Register route redirects seamlessly to the unified Staff Registration tab on /login
 */
export const Register: React.FC = () => {
  return <Navigate to="/login?portal=staff&mode=register" replace />;
};

import React from 'react';

// Delad navigation ref så att moduler utanför navigation-trädet
// (push-notiser, globala modaler) kan navigera.
export const navigationRef = React.createRef();

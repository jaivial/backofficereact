import { renderPage } from 'vike/server';

const ctx = {
  urlOriginal: '/app/miembros/1/estadisticas',
  headersOriginal: {},
  bo: {
    theme: 'dark',
    session: {
      user: {
        id: 1,
        email: 'test@example.com',
        name: 'Test',
        role: 'admin',
        roleImportance: 100,
        sectionAccess: ['all'],
      },
      restaurants: [{ id: 1, slug: 'test', name: 'Test' }],
      activeRestaurantId: 1,
    },
  },
  boRequest: {
    cookieHeader: '',
    backendOrigin: 'http://127.0.0.1:8080',
  },
};

try {
  const pageContext = await renderPage(ctx);
  const http = pageContext.httpResponse;
  console.log('status=', http?.statusCode);
  console.log('contentType=', http?.contentType);
  if (http?.statusCode && http.statusCode >= 500) {
    const body = String(http.body ?? '');
    console.log(body.slice(0, 1200));
  }
} catch (err) {
  console.error('renderPage threw:', err);
}

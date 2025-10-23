const response = $input.item.json.response;
const parsedResponse = $('Response Parser').item.json.parsedResponse;
const query = $('Extract Query').item.json.query;

if (!parsedResponse.schema || response.data.length === 0) {
  return [$input.item];
}

const enrichedSchema = parsedResponse.schema.map(field => {
  const examples = response.data.slice(0, 5).map(r => r[field.name]).filter(v => v != null);
  return {
    name: field.name,
    type: field.type,
    description: `Auto-generated field`,
    examples: examples.length > 0 ? examples : ['sample']
  };
});

const domainName = (parsedResponse.message || query).replace(/[^a-zA-Z0-9\s-]/g, '').trim().substring(0, 50) || 'auto_' + Date.now();

try {
  await this.helpers.httpRequest({
    method: 'POST',
    url: 'http://host.docker.internal:5678/webhook/manage-domain-with-registry',
    body: {
      domain: domainName,
      schema: enrichedSchema,
      action: 'create',
      description: `From: ${query}`,
      category: 'Auto-Generated'
    },
    json: true
  });
} catch (e) {}

return [$input.item];


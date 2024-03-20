var async = require('async');
var helpers = require('../../../helpers/azure');

module.exports = {
    title: 'Databricks Workspace DBFS Infrastructure Encryption',
    category: 'AI & ML',
    domain: 'Machine Learning',
    severity: 'Medium',
    description: 'Ensures that DBFS root for Databricks workspace has Infrastrucure encryption enabled.',
    more_info: 'Enabling infrastructure level encryption for Azure Databricks workspace DBFS root allows data in storage account to be encrypted twice, once at the service level and once at the infrastructure level, using two different encryption algorithms and two different keys and provides an extra layer of protection and security in case one of the keys is compromised.',
    recommended_action: 'Enable infrastructure level encryption for all Azure Databricks workspace DBFS root.',
    link: 'https://learn.microsoft.com/en-us/azure/databricks/security/keys/#--enable-double-encryption-for-dbfs',
    apis: ['databricks:listWorkspaces'],
    realtime_triggers: ['microsoftdatabricks:workspaces:write','microsoftdatabricks:workspaces:delete'],

    run: function(cache, settings, callback) {
        const results = [];
        const source = {};
        const locations = helpers.locations(settings.govcloud);

        async.each(locations.databricks, function(location, rcb) {
            const databricks = helpers.addSource(cache, source,
                ['databricks', 'listWorkspaces', location]);

            if (!databricks) return rcb();
            
            if (databricks.err || !databricks.data) {
                helpers.addResult(results, 3, 'Unable to query for Databricks Workspaces: ' + helpers.addError(databricks), location);
                return rcb();
            }

            if (!databricks.data.length) {
                helpers.addResult(results, 0, 'No existing Databricks Workspaces found', location);
                return rcb();
            }

            for (let workspace of databricks.data) {

                if (workspace.sku && workspace.sku.name && workspace.sku.name.toLowerCase()!='premium') {
                    helpers.addResult(results, 0, 'Databricks workspace is not a premium workspace', location, workspace.id);
                } else if (workspace.parameters && workspace.parameters.requireInfrastructureEncryption && workspace.parameters.requireInfrastructureEncryption.value) {
                    helpers.addResult(results, 0, 'Databricks workspace DBFS root has infrastructure level encryption enabled', location, workspace.id);
                }  else {
                    helpers.addResult(results, 2, 'Databricks workspace DBFS root does not have infrastructure level encryption enabled', location, workspace.id);
                }
            }

            rcb();
        }, function() {
            // Global checking goes here
            callback(null, results, source);
        });
    }
};
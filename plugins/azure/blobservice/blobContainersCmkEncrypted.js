var async = require('async');

var helpers = require('../../../helpers/azure');

module.exports = {
    title: 'Blob Container CMK Encrypted',
    category: 'Blob Service',
    domain: 'Storage',
    description: '',
    more_info: '',
    recommended_action: '',
    link: '',
    apis: ['storageAccounts:list', 'blobContainers:list', 'encryptionScopes:listByStorageAccounts'],
    realtime_triggers: ['microsoftstorage:storageaccounts:blobservices:containers:write', 'microsoftstorage:storageaccounts:blobservices:containers:delete'],

    run: function (cache, settings, callback) {
        var results = [];
        var source = {};
        var locations = helpers.locations(settings.govcloud);
        async.each(locations.storageAccounts, (location, rcb) => {
            const storageAccounts = helpers.addSource(
                cache, source, ['storageAccounts', 'list', location]
            );

            if (!storageAccounts) return rcb();

            if (storageAccounts.err || !storageAccounts.data) {
                helpers.addResult(results, 3,
                    'Unable to query for Storage Accounts: ' + helpers.addError(storageAccounts), location);
                return rcb();
            }

            if (!storageAccounts.data.length) {
                helpers.addResult(
                    results, 0, 'No existing Storage Accounts found', location);
                return rcb();
            }

            for (var storageAccount of storageAccounts.data) {
                const blobContainers = helpers.addSource(
                    cache, source, ['blobContainers', 'list', location, storageAccount.id]
                );

                if (!blobContainers || blobContainers.err || !blobContainers.data) {
                    helpers.addResult(results, 3,
                        'Unable to query Blob Containers: ' + helpers.addError(blobContainers),
                        location, storageAccount.id);
                } else if (!blobContainers.data.length) {
                    helpers.addResult(results, 0, 'Storage Account does not contain blob containers', location, storageAccount.id);
                } else {
                   const encryptionScopes = helpers.addSource(
                    cache, source, ['encryptionScopes', 'listByStorageAccounts', location, storageAccount.id]);

                    if (!encryptionScopes || encryptionScopes.err || !encryptionScopes.data) {
                        helpers.addResult(results, 3,
                            'Unable to query encryption scopes for Storage Accounts: ' + helpers.addError(encryptionScopes),
                            location, storageAccount.id);
                            break;
                    } else {
                        var cmkEncryptionScopes = encryptionScopes.data.filter(function (scope) {
                          return scope.keyVaultProperties && scope.keyVaultProperties.keyUri;
                        }).map(function (scope) {
                          return scope.name;
                        });
                        var unencryptedCmkBlobs = blobContainers.data.filter(function (blob) {
                            return !cmkEncryptionScopes.includes(blob.defaultEncryptionScope);
                          }).map(function(blob){
                            return blob.name
                          });
                        if(unencryptedCmkBlobs && unencryptedCmkBlobs.length){
                            helpers.addResult(results, 2, `Storage Account does not have CMK encryption enabled on following blob containers: ${unencryptedCmkBlobs.join(',')}`, location, storageAccount.id);
                        } else {
                            helpers.addResult(results, 0, 'Storage Account has CMK encryption enabled on all blob containers', location, storageAccount.id);

                        }
                    }

                }
            }

            rcb();
        }, function () {
            callback(null, results, source);
        });
    }
};
const async = require('async');
const helpers = require('../../../helpers/azure');

module.exports = {
    title: 'Front Door Default Forwarding Rule',
    category: 'Front Door',
    domain: 'Content Delivery',
    description: 'Ensures HTTPS Only is enabled for Front Door Classic profile, redirecting all HTTP traffic to HTTPS.',
    more_info: 'By using the HTTPS only protocol, you ensure that your sensitive data is delivered securely via TLS/SSL encryption.',
    recommended_action: 'Ensure that Front Door (classic) under the frontend hosts section has HTTP to HTTPS redirect rule.',
    link: 'https://learn.microsoft.com/en-us/azure/frontdoor/front-door-how-to-redirect-https',
    apis: ['classicFrontDoors:list'],

    run: function(cache, settings, callback) {
        const results = [];
        const source = {};
        const locations = helpers.locations(settings.govcloud);
        async.each(locations.classicFrontDoors, (location, rcb) => {
            const classicFrontDoors = 
            helpers.addSource(cache, source,
                ['classicFrontDoors', 'list', location]);

            if (!classicFrontDoors) return rcb();

            if (classicFrontDoors.err || !classicFrontDoors.data) {
                helpers.addResult(results, 3,
                    'Unable to query Front Door profiles: ' + helpers.addError(classicFrontDoors), location);
                return rcb();
            }

            if (!classicFrontDoors.data.length) {
                helpers.addResult(results, 0, 'No existing Classic Front Door profiles found', location);
                return rcb();
            }

            classicFrontDoors.data.forEach(function(frontDoor) {
                if (!frontDoor.id || !frontDoor.routingRules) return;

                var ruleFound = false;
                for (var rule of frontDoor.routingRules) {
                    var ruleProperties = rule.properties? rule.properties : {};
                    if (ruleProperties.acceptedProtocols && ruleProperties.acceptedProtocols[0].toLowerCase() =='https') {
                        if (ruleProperties.routeConfiguration && 
                            ruleProperties.routeConfiguration.forwardingProtocol && 
                            ruleProperties.routeConfiguration.forwardingProtocol.toLowerCase() == 'httpsonly') {
                            ruleFound = true;
                            break;
                        }
                    }
                }

                if (ruleFound) {
                    helpers.addResult(results, 0, 'Classic Front Door profile has default forwarding rule', location, frontDoor.id);
                } else {
                    helpers.addResult(results, 2, 'Classic Front Door profile does not have default forwarding rule', location, frontDoor.id);
                }
               
            });
            rcb();
        }, function() {
            callback(null, results, source);
        });
    }
};
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = function withIosPersonalTeam(config) {
  return withEntitlementsPlist(config, (c) => {
    // Registered first so this mod runs after library entitlement mods.
    delete c.modResults["aps-environment"];
    delete c.modResults["com.apple.developer.associated-domains"];
    delete c.modResults["com.apple.developer.applesignin"];
    return c;
  });
};

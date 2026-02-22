package com.jask.bitbucket.ao;

import net.java.ao.Entity;
import net.java.ao.Preload;
import net.java.ao.schema.Indexed;
import net.java.ao.schema.StringLength;
import net.java.ao.schema.Table;

/**
 * Active Objects entity for plugin configuration settings.
 */
@Table("JASK_SETTINGS")
@Preload
public interface PluginSettingsEntity extends Entity {

    @Indexed
    String getSettingKey();
    void setSettingKey(String settingKey);

    @StringLength(StringLength.UNLIMITED)
    String getSettingValue();
    void setSettingValue(String settingValue);

    String getScope();
    void setScope(String scope);

    int getScopeId();
    void setScopeId(int scopeId);

    long getUpdatedAt();
    void setUpdatedAt(long updatedAt);

    String getUpdatedBy();
    void setUpdatedBy(String updatedBy);
}

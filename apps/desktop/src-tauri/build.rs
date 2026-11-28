fn main() {
    // App commands need an explicit permission; the runtime capability in lib.rs grants them
    // only to the DevHub origin.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "folders_list",
            "folders_add",
            "folders_remove",
            "git_status",
            "open_in",
            "tools",
            "notify",
            "set_unread",
            "docker_containers",
            "agent_status",
            "agent_pair",
            "agent_unpair",
            "docs_list",
            "docs_read",
            "ai_inventory",
        ]),
    ))
    .expect("failed to run tauri-build");
}

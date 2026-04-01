"""
Jenny Plugin Loader
Discovers and loads plugins from the plugins/ directory.
"""

from __future__ import annotations

import importlib.util
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from jenny.plugins.base import PluginBase

logger = logging.getLogger("jenny.plugins")


class PluginLoader:
    """Discovers, loads, and manages Jenny plugins."""

    def __init__(self, plugins_dir: str = ""):
        self.plugins_dir = Path(plugins_dir) if plugins_dir else None
        self._plugins: Dict[str, PluginBase] = {}

    def discover(self, search_dir: Optional[str] = None) -> List[Dict[str, Any]]:
        """Scan directory for plugins with plugin.json manifests."""
        root = Path(search_dir) if search_dir else self.plugins_dir
        if not root or not root.exists():
            return []

        found = []
        for entry in root.iterdir():
            if entry.is_dir():
                manifest_path = entry / "plugin.json"
                if manifest_path.exists():
                    try:
                        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
                        manifest["_path"] = str(entry)
                        found.append(manifest)
                        logger.info(f"Discovered plugin: {manifest.get('name', entry.name)}")
                    except Exception as e:
                        logger.warning(f"Bad plugin manifest at {manifest_path}: {e}")

        return found

    def load(self, manifest: Dict[str, Any]) -> Optional[PluginBase]:
        """Load a single plugin from its manifest."""
        plugin_id = manifest.get("id", "")
        plugin_path = Path(manifest.get("_path", ""))
        entry = manifest.get("entry", "main.py")

        entry_path = plugin_path / entry
        if not entry_path.exists():
            logger.error(f"Plugin entry not found: {entry_path}")
            return None

        try:
            spec = importlib.util.spec_from_file_location(
                f"jenny.plugins.{plugin_id}",
                str(entry_path),
            )
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)

            # Find the PluginBase subclass
            plugin_class = None
            for attr_name in dir(module):
                attr = getattr(module, attr_name)
                if (
                    isinstance(attr, type)
                    and issubclass(attr, PluginBase)
                    and attr is not PluginBase
                ):
                    plugin_class = attr
                    break

            if not plugin_class:
                logger.error(f"No PluginBase subclass found in {entry_path}")
                return None

            instance = plugin_class(manifest)
            instance.on_load()
            self._plugins[plugin_id] = instance
            logger.info(f"Loaded plugin: {instance.name} v{instance.version}")
            return instance

        except Exception as e:
            logger.error(f"Failed to load plugin {plugin_id}: {e}")
            return None

    def load_all(self, search_dir: Optional[str] = None) -> int:
        """Discover and load all plugins."""
        manifests = self.discover(search_dir)
        loaded = 0
        for m in manifests:
            if self.load(m):
                loaded += 1
        return loaded

    def get_plugin(self, plugin_id: str) -> Optional[PluginBase]:
        return self._plugins.get(plugin_id)

    def list_plugins(self) -> List[Dict[str, Any]]:
        return [p.get_info() for p in self._plugins.values()]

    async def execute(self, plugin_id: str, params: dict) -> Dict[str, Any]:
        """Execute a loaded plugin."""
        plugin = self._plugins.get(plugin_id)
        if not plugin:
            return {"error": f"Plugin not found: {plugin_id}"}
        return await plugin.execute(params)

    def unload_all(self) -> None:
        for plugin in self._plugins.values():
            try:
                plugin.on_unload()
            except Exception as e:
                logger.error(f"Plugin unload error ({plugin.id}): {e}")
        self._plugins.clear()

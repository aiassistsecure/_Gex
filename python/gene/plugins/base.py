"""
Gene Plugin Base Class
All plugins extend this class to integrate with the Gene runtime.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, Optional


class PluginBase(ABC):
    """Base class for Gene plugins.

    Plugins are discovered from the plugins/ directory.
    Each plugin must have a plugin.json manifest and a main module
    that exports a class extending PluginBase.

    Lifecycle:
        1. on_load() — called when the plugin is loaded
        2. execute() — called when the plugin is invoked
        3. on_unload() — called when the plugin is unloaded

    Example plugin.json:
        {
            "id": "my-plugin",
            "name": "My Plugin",
            "version": "1.0.0",
            "entry": "main.py",
            "description": "Does something cool"
        }
    """

    def __init__(self, manifest: Dict[str, Any]):
        self.manifest = manifest
        self.id = manifest.get("id", "unknown")
        self.name = manifest.get("name", self.id)
        self.version = manifest.get("version", "0.0.0")

    def on_load(self) -> None:
        """Called when the plugin is loaded. Override for setup logic."""
        pass

    def on_unload(self) -> None:
        """Called when the plugin is unloaded. Override for cleanup."""
        pass

    @abstractmethod
    async def execute(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Execute the plugin's main action.

        Args:
            params: Input parameters from the caller

        Returns:
            Result dictionary
        """
        ...

    def get_info(self) -> Dict[str, Any]:
        """Get plugin metadata."""
        return {
            "id": self.id,
            "name": self.name,
            "version": self.version,
            "description": self.manifest.get("description", ""),
        }

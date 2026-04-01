"""
Jenny Background Job Queue
In-process async job queue with priority, timeout, and WebSocket notifications.
"""

from __future__ import annotations

import asyncio
import logging
import time
import uuid
from enum import Enum
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger("jenny.jobs")


class JobStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Job:
    def __init__(
        self,
        func: Callable,
        args: tuple = (),
        kwargs: dict = None,
        priority: int = 0,
        timeout: float = 300,
        job_id: Optional[str] = None,
        name: str = "",
    ):
        self.id = job_id or str(uuid.uuid4())[:8]
        self.name = name or func.__name__
        self.func = func
        self.args = args
        self.kwargs = kwargs or {}
        self.priority = priority
        self.timeout = timeout
        self.status = JobStatus.PENDING
        self.result = None
        self.error = None
        self.created_at = time.time()
        self.started_at = None
        self.completed_at = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status.value,
            "priority": self.priority,
            "result": self.result,
            "error": self.error,
            "created_at": self.created_at,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "duration_ms": (
                round((self.completed_at - self.started_at) * 1000, 1)
                if self.started_at and self.completed_at
                else None
            ),
        }


class JobQueue:
    """Async in-process job queue."""

    def __init__(self, max_concurrent: int = 3):
        self.max_concurrent = max_concurrent
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._jobs: Dict[str, Job] = {}
        self._running = False
        self._workers: List[asyncio.Task] = []
        self._on_complete: Optional[Callable] = None

    def on_complete(self, callback: Callable) -> None:
        """Register a callback for job completion (e.g., WebSocket notification)."""
        self._on_complete = callback

    async def submit(self, job: Job) -> str:
        """Submit a job to the queue."""
        self._jobs[job.id] = job
        await self._queue.put((-job.priority, job.created_at, job.id))
        logger.info(f"Job submitted: {job.name} ({job.id})")
        return job.id

    async def start(self) -> None:
        """Start worker tasks."""
        if self._running:
            return
        self._running = True
        for i in range(self.max_concurrent):
            task = asyncio.create_task(self._worker(i))
            self._workers.append(task)
        logger.info(f"Job queue started with {self.max_concurrent} workers")

    async def stop(self) -> None:
        """Stop all workers."""
        self._running = False
        for w in self._workers:
            w.cancel()
        self._workers.clear()

    async def _worker(self, worker_id: int) -> None:
        """Worker loop — picks jobs from the queue and executes them."""
        while self._running:
            try:
                priority, created_at, job_id = await asyncio.wait_for(
                    self._queue.get(), timeout=1.0
                )
            except asyncio.TimeoutError:
                continue

            job = self._jobs.get(job_id)
            if not job or job.status == JobStatus.CANCELLED:
                continue

            job.status = JobStatus.RUNNING
            job.started_at = time.time()

            try:
                if asyncio.iscoroutinefunction(job.func):
                    job.result = await asyncio.wait_for(
                        job.func(*job.args, **job.kwargs),
                        timeout=job.timeout,
                    )
                else:
                    job.result = job.func(*job.args, **job.kwargs)

                job.status = JobStatus.COMPLETED
            except asyncio.TimeoutError:
                job.status = JobStatus.FAILED
                job.error = f"Timeout after {job.timeout}s"
            except Exception as e:
                job.status = JobStatus.FAILED
                job.error = str(e)

            job.completed_at = time.time()
            logger.info(f"Job {job.status.value}: {job.name} ({job.id})")

            if self._on_complete:
                try:
                    await self._on_complete(job.to_dict())
                except Exception:
                    pass

    def get_job(self, job_id: str) -> Optional[Dict]:
        job = self._jobs.get(job_id)
        return job.to_dict() if job else None

    def list_jobs(self, status: Optional[str] = None) -> List[Dict]:
        jobs = self._jobs.values()
        if status:
            jobs = [j for j in jobs if j.status.value == status]
        return [j.to_dict() for j in jobs]

    def cancel(self, job_id: str) -> bool:
        job = self._jobs.get(job_id)
        if job and job.status == JobStatus.PENDING:
            job.status = JobStatus.CANCELLED
            return True
        return False

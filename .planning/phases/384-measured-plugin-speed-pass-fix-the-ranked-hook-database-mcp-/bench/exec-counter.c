/*
 * Phase 384 plan 04: exec counter (LD_PRELOAD shared library).
 *
 * strace is not installed on the measurement host, so this library counts exec calls instead. It
 * interposes execve, execv, execvp, execvpe, execl, execlp, execle, posix_spawn and posix_spawnp.
 * Before it calls the real function it appends ONE line to the file named by MOS_EXEC_LOG, with one
 * write call on a descriptor opened with O_APPEND:
 *
 *   E <pid> <ppid> <monotonic ns> <program base name> <script base name or ->
 *
 * The script base name is the base name of argv[1], only when the program is node, bash, sh, dash or
 * env and argv[1] does not start with a dash. If the real call returns (it failed) the library appends
 *   F <pid>
 * The count of a run is the number of E lines minus the number of F lines.
 * The library logs no argument other than those two base names (Canon Part 8, threat T-384-17).
 *
 * Environment carry-over: a child that is started with an explicit environment which lacks LD_PRELOAD
 * would hide its whole subtree from the count. When this process has LD_PRELOAD, MOS_EXEC_LOG,
 * MOS_EXEC_BLOCK or MOS_PERF_RUN_ID and the child environment lacks the name, the library adds the
 * missing names to the environment of the child and appends the line  I <pid>  to the log. Nothing else
 * changes (threat T-384-16). The census reports the number of I lines.
 *
 * Block list: if MOS_EXEC_BLOCK holds a comma list of program base names, a call whose program base
 * name is in the list is logged as
 *   B <pid> <ppid> <monotonic ns> <program base name>
 * and fails with errno EACCES without running the program. B lines are not part of the count.
 *
 * Build: gcc -shared -fPIC -O2 -o exec-counter.so exec-counter.c -ldl
 * Limits: a static binary, and a library call that starts a process from inside libc without going
 * through the dynamic symbol (for example system() or popen() in a C program), are not seen.
 */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <fcntl.h>
#include <spawn.h>
#include <stdarg.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include <unistd.h>

extern char **environ;

static int (*real_execve)(const char *, char *const[], char *const[]);
static int (*real_execv)(const char *, char *const[]);
static int (*real_execvp)(const char *, char *const[]);
static int (*real_execvpe)(const char *, char *const[], char *const[]);
static int (*real_posix_spawn)(pid_t *, const char *, const posix_spawn_file_actions_t *, const posix_spawnattr_t *, char *const[], char *const[]);
static int (*real_posix_spawnp)(pid_t *, const char *, const posix_spawn_file_actions_t *, const posix_spawnattr_t *, char *const[], char *const[]);

static void load_real(void) {
  if (real_execve) return;
  real_execve = dlsym(RTLD_NEXT, "execve");
  real_execv = dlsym(RTLD_NEXT, "execv");
  real_execvp = dlsym(RTLD_NEXT, "execvp");
  real_execvpe = dlsym(RTLD_NEXT, "execvpe");
  real_posix_spawn = dlsym(RTLD_NEXT, "posix_spawn");
  real_posix_spawnp = dlsym(RTLD_NEXT, "posix_spawnp");
}

static const char *base_of(const char *p) {
  const char *s;
  if (!p) return "?";
  s = strrchr(p, '/');
  return s ? s + 1 : p;
}

static void append_line(const char *buf, size_t n) {
  const char *log = getenv("MOS_EXEC_LOG");
  int fd;
  if (!log || !*log) return;
  fd = open(log, O_WRONLY | O_APPEND | O_CREAT | O_CLOEXEC, 0600);
  if (fd < 0) return;
  if (write(fd, buf, n) < 0) { /* nothing to do */ }
  close(fd);
}

static long long mono_ns(void) {
  struct timespec ts;
  clock_gettime(CLOCK_MONOTONIC, &ts);
  return (long long)ts.tv_sec * 1000000000LL + ts.tv_nsec;
}

static int is_shell_like(const char *prog) {
  return !strcmp(prog, "node") || !strcmp(prog, "bash") || !strcmp(prog, "sh") || !strcmp(prog, "dash") || !strcmp(prog, "env");
}

/* 1 when the program base name is in the MOS_EXEC_BLOCK list. */
static int blocked(const char *prog) {
  const char *list = getenv("MOS_EXEC_BLOCK");
  size_t n = strlen(prog);
  const char *p;
  if (!list || !*list || !n) return 0;
  p = list;
  while (*p) {
    const char *e = strchr(p, ',');
    size_t len = e ? (size_t)(e - p) : strlen(p);
    if (len == n && !strncmp(p, prog, n)) return 1;
    if (!e) break;
    p = e + 1;
  }
  return 0;
}

/* Log an E line (or a B line when blocked). Returns 1 when the call must fail with EACCES. */
static int note_exec(const char *path, char *const argv[]) {
  char buf[512];
  char prog[160];
  char script[160];
  int n;
  const char *b = base_of(path);
  strncpy(prog, b, sizeof(prog) - 1);
  prog[sizeof(prog) - 1] = 0;
  strcpy(script, "-");
  if (argv && argv[0] && argv[1] && is_shell_like(prog) && argv[1][0] != '-') {
    strncpy(script, base_of(argv[1]), sizeof(script) - 1);
    script[sizeof(script) - 1] = 0;
  }
  /* a base name that holds a space or a newline would break the line format */
  for (n = 0; prog[n]; n += 1) if (prog[n] == ' ' || prog[n] == '\n') prog[n] = '_';
  for (n = 0; script[n]; n += 1) if (script[n] == ' ' || script[n] == '\n') script[n] = '_';
  if (blocked(prog)) {
    n = snprintf(buf, sizeof(buf), "B %d %d %lld %s\n", (int)getpid(), (int)getppid(), mono_ns(), prog);
    if (n > 0) append_line(buf, (size_t)n);
    return 1;
  }
  n = snprintf(buf, sizeof(buf), "E %d %d %lld %s %s\n", (int)getpid(), (int)getppid(), mono_ns(), prog, script);
  if (n > 0) append_line(buf, (size_t)n);
  return 0;
}

static void note_fail(void) {
  char buf[64];
  int n = snprintf(buf, sizeof(buf), "F %d\n", (int)getpid());
  if (n > 0) append_line(buf, (size_t)n);
}

static int env_has(char *const envp[], const char *name) {
  size_t n = strlen(name);
  int i;
  if (!envp) return 0;
  for (i = 0; envp[i]; i += 1) {
    if (!strncmp(envp[i], name, n) && envp[i][n] == '=') return 1;
  }
  return 0;
}

static const char *CARRY[] = { "LD_PRELOAD", "MOS_EXEC_LOG", "MOS_EXEC_BLOCK", "MOS_PERF_RUN_ID", NULL };

/* Returns envp when nothing is missing, else a new array (malloc) with the missing carry names added. */
static char **carry_env(char *const envp[], int *injected) {
  int missing = 0;
  int count = 0;
  int i;
  char **out;
  int k;
  *injected = 0;
  for (i = 0; CARRY[i]; i += 1) {
    if (getenv(CARRY[i]) && !env_has(envp, CARRY[i])) missing += 1;
  }
  if (!missing) return (char **)envp;
  if (envp) while (envp[count]) count += 1;
  out = (char **)malloc(sizeof(char *) * (size_t)(count + missing + 1));
  if (!out) return (char **)envp;
  for (i = 0; i < count; i += 1) out[i] = envp[i];
  k = count;
  for (i = 0; CARRY[i]; i += 1) {
    const char *v = getenv(CARRY[i]);
    if (v && !env_has(envp, CARRY[i])) {
      size_t len = strlen(CARRY[i]) + strlen(v) + 2;
      char *e = (char *)malloc(len);
      if (!e) continue;
      snprintf(e, len, "%s=%s", CARRY[i], v);
      out[k] = e;
      k += 1;
    }
  }
  out[k] = NULL;
  *injected = 1;
  return out;
}

static void note_injected(void) {
  char buf[64];
  int n = snprintf(buf, sizeof(buf), "I %d\n", (int)getpid());
  if (n > 0) append_line(buf, (size_t)n);
}

int execve(const char *path, char *const argv[], char *const envp[]) {
  int inj;
  char **e2;
  int r;
  load_real();
  if (note_exec(path, argv)) { errno = EACCES; return -1; }
  e2 = carry_env(envp, &inj);
  if (inj) note_injected();
  r = real_execve(path, argv, e2);
  note_fail();
  return r;
}

int execv(const char *path, char *const argv[]) {
  int inj;
  char **e2;
  int r;
  load_real();
  if (note_exec(path, argv)) { errno = EACCES; return -1; }
  e2 = carry_env(environ, &inj);
  if (inj) { note_injected(); r = real_execve(path, argv, e2); }
  else r = real_execv(path, argv);
  note_fail();
  return r;
}

int execvp(const char *file, char *const argv[]) {
  int inj;
  char **e2;
  int r;
  load_real();
  if (note_exec(file, argv)) { errno = EACCES; return -1; }
  e2 = carry_env(environ, &inj);
  if (inj) { note_injected(); r = real_execvpe(file, argv, e2); }
  else r = real_execvp(file, argv);
  note_fail();
  return r;
}

int execvpe(const char *file, char *const argv[], char *const envp[]) {
  int inj;
  char **e2;
  int r;
  load_real();
  if (note_exec(file, argv)) { errno = EACCES; return -1; }
  e2 = carry_env(envp, &inj);
  if (inj) note_injected();
  r = real_execvpe(file, argv, e2);
  note_fail();
  return r;
}

/* The variadic family: collect the arguments, then do what the matching non-variadic call does. */
#define MAX_ARGS 1024

static int collect_args(const char *arg0, va_list ap, char *argv[], char ***envp_out, int want_env) {
  int n = 0;
  const char *a = arg0;
  while (n < MAX_ARGS - 1) {
    argv[n] = (char *)a;
    n += 1;
    if (!a) break;
    a = va_arg(ap, const char *);
  }
  if (want_env) *envp_out = va_arg(ap, char **);
  argv[n < MAX_ARGS ? n : MAX_ARGS - 1] = NULL;
  return n;
}

int execl(const char *path, const char *arg, ...) {
  char *argv[MAX_ARGS];
  va_list ap;
  va_start(ap, arg);
  collect_args(arg, ap, argv, NULL, 0);
  va_end(ap);
  return execv(path, argv);
}

int execlp(const char *file, const char *arg, ...) {
  char *argv[MAX_ARGS];
  va_list ap;
  va_start(ap, arg);
  collect_args(arg, ap, argv, NULL, 0);
  va_end(ap);
  return execvp(file, argv);
}

int execle(const char *path, const char *arg, ...) {
  char *argv[MAX_ARGS];
  char **envp = NULL;
  va_list ap;
  va_start(ap, arg);
  collect_args(arg, ap, argv, &envp, 1);
  va_end(ap);
  return execve(path, argv, envp);
}

int posix_spawn(pid_t *pid, const char *path, const posix_spawn_file_actions_t *fa, const posix_spawnattr_t *attr, char *const argv[], char *const envp[]) {
  int inj;
  char **e2;
  int r;
  load_real();
  if (note_exec(path, argv)) return EACCES;
  e2 = carry_env(envp, &inj);
  if (inj) note_injected();
  r = real_posix_spawn(pid, path, fa, attr, argv, e2);
  if (r != 0) note_fail();
  return r;
}

int posix_spawnp(pid_t *pid, const char *file, const posix_spawn_file_actions_t *fa, const posix_spawnattr_t *attr, char *const argv[], char *const envp[]) {
  int inj;
  char **e2;
  int r;
  load_real();
  if (note_exec(file, argv)) return EACCES;
  e2 = carry_env(envp, &inj);
  if (inj) note_injected();
  r = real_posix_spawnp(pid, file, fa, attr, argv, e2);
  if (r != 0) note_fail();
  return r;
}

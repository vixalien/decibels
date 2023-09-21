project('decibels',
          version: '0.1.0',
    meson_version: '>= 0.62.0',
  default_options: [ 'warning_level=2', 'werror=false', ],
)

if get_option('profile') == 'development'
  profile = 'Devel'
  name_suffix = ' (Development)'
  vcs_tag = run_command('git', 'rev-parse', '--short', 'HEAD', check: true).stdout().strip()
  if vcs_tag == ''
    version_suffix = '-devel'
  else
    version_suffix = '-@0@'.format (vcs_tag)
  endif
else
  profile = ''
  name_suffix = ''
  version_suffix = ''
endif

application_id = 'com.vixalien.decibels@0@'.format(profile)

i18n = import('i18n')
gnome = import('gnome')

gettext_package = application_id
decibels_prefix = get_option('prefix')
decibels_bindir = decibels_prefix / get_option('bindir')
decibels_libdir = decibels_prefix / get_option('libdir')
decibels_datadir = decibels_prefix / get_option('datadir')
decibels_pkgdatadir = decibels_datadir / application_id
decibels_schemadir = decibels_datadir / 'glib-2.0' / 'schemas'

gjs_dep = dependency('gjs-1.0', version: '>= 1.54.0')
gjs_console = gjs_dep.get_variable(pkgconfig: 'gjs_console')

tsc = find_program('tsc', required: true)

subdir('data')
subdir('src')
subdir('po')

gnome.post_install(
     glib_compile_schemas: true,
    gtk_update_icon_cache: true,
  update_desktop_database: true,
)

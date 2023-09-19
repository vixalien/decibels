desktop_file = i18n.merge_file(
        input: 'com.vixalien.decibels.desktop.in',
       output: 'com.vixalien.decibels.desktop',
         type: 'desktop',
       po_dir: '../po',
      install: true,
  install_dir: join_paths(get_option('datadir'), 'applications')
)

desktop_utils = find_program('desktop-file-validate', required: false)
if desktop_utils.found()
  test('Validate desktop file', desktop_utils, args: [desktop_file])
endif

appstream_file = i18n.merge_file(
        input: 'com.vixalien.decibels.metainfo.xml.in',
       output: 'com.vixalien.decibels.metainfo.xml',
       po_dir: '../po',
      install: true,
  install_dir: join_paths(get_option('datadir'), 'metainfo')
)

appstream_util = find_program('appstream-util', required: false)
if appstream_util.found()
  test('Validate appstream file', appstream_util, args: ['validate', '--nonet', appstream_file])
endif

gsettings_schema = 'com.vixalien.decibels.gschema.xml'

local_schemas = configure_file(
  copy: true,
  input: gsettings_schema,
  output: gsettings_schema
)

install_data(gsettings_schema,
  install_dir: join_paths(get_option('datadir'), 'glib-2.0/schemas')
)

compile_schemas = find_program('glib-compile-schemas', required: false)

compile_local_schemas = custom_target(
  'compile_local_schemas',
  input: local_schemas,
  output: 'gschemas.compiled',
  command: [compile_schemas, meson.current_build_dir()]
)

if compile_schemas.found()
  test('Validate schema file',
       compile_schemas,
       args: ['--strict', '--dry-run', meson.current_source_dir()])
endif

data_res = gnome.compile_resources(
  'com.vixalien.decibels.data',
  'com.vixalien.decibels.data.gresource.xml',
  gresource_bundle: true,
  install: true,
  install_dir: pkgdatadir,
  dependencies: appstream_file,
)

service_conf = configuration_data()
service_conf.set('application_id', application_id)
service_conf.set('bindir', get_option('prefix') / get_option('bindir'))
configure_file(
  input: 'com.vixalien.decibels.service.in',
  output: '@0@.service'.format(application_id),
  configuration: service_conf,
  install: true,
  install_dir: get_option('datadir') / 'dbus-1/services',
)

subdir('icons')

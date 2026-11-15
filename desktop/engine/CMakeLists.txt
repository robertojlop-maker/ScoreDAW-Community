# =====================================================================
#  ScoreDAW — native plugin engine (Visual Studio 2022 / MSVC build)
#  Prebuilt binaries are already in ..\dist (built with MinGW-w64);
#  use this only to rebuild the engine yourself:
#     cmake -S engine -B build-engine -G "Visual Studio 17 2022" -A x64
#     cmake --build build-engine --config Release
#  The VST3 SDK (MIT) and CLAP (MIT) are downloaded from GitHub.
# =====================================================================
cmake_minimum_required(VERSION 3.25)
project(ScoreDawEngine CXX C)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>")   # no VC++ redistributable needed

include(FetchContent)
FetchContent_Declare(vst3sdk GIT_REPOSITORY https://github.com/steinbergmedia/vst3sdk.git GIT_TAG master GIT_SHALLOW TRUE GIT_SUBMODULES base pluginterfaces public.sdk)
FetchContent_Declare(clap GIT_REPOSITORY https://github.com/free-audio/clap.git GIT_TAG main GIT_SHALLOW TRUE)
FetchContent_GetProperties(vst3sdk)
if(NOT vst3sdk_POPULATED)
  FetchContent_Populate(vst3sdk)
endif()
FetchContent_GetProperties(clap)
if(NOT clap_POPULATED)
  FetchContent_Populate(clap)
endif()
set(V ${vst3sdk_SOURCE_DIR})
set(SDK_SOURCES
  ${V}/base/source/baseiids.cpp ${V}/base/source/fbuffer.cpp ${V}/base/source/fdebug.cpp ${V}/base/source/fobject.cpp
  ${V}/base/source/fstreamer.cpp ${V}/base/source/fstring.cpp ${V}/base/source/updatehandler.cpp
  ${V}/base/thread/source/fcondition.cpp ${V}/base/thread/source/flock.cpp
  ${V}/pluginterfaces/base/conststringtable.cpp ${V}/pluginterfaces/base/coreiids.cpp ${V}/pluginterfaces/base/funknown.cpp ${V}/pluginterfaces/base/ustring.cpp
  ${V}/public.sdk/source/common/commoniids.cpp ${V}/public.sdk/source/common/commonstringconvert.cpp ${V}/public.sdk/source/common/memorystream.cpp
  ${V}/public.sdk/source/common/threadchecker_win32.cpp
  ${V}/public.sdk/source/vst/utility/stringconvert.cpp ${V}/public.sdk/source/vst/vstinitiids.cpp
  ${V}/public.sdk/source/vst/hosting/module.cpp ${V}/public.sdk/source/vst/hosting/module_win32.cpp
  ${V}/public.sdk/source/vst/hosting/hostclasses.cpp ${V}/public.sdk/source/vst/hosting/plugprovider.cpp
  ${V}/public.sdk/source/vst/hosting/processdata.cpp ${V}/public.sdk/source/vst/hosting/eventlist.cpp
  ${V}/public.sdk/source/vst/hosting/parameterchanges.cpp ${V}/public.sdk/source/vst/hosting/connectionproxy.cpp
  ${V}/public.sdk/source/vst/hosting/pluginterfacesupport.cpp)
set(ENGINE_SOURCES vst3host.cpp claphost.cpp engine.cpp)
set(DEFS UNICODE _UNICODE NOMINMAX RELEASE=1)
set(LIBS ole32 oleaut32 uuid avrt shell32 shlwapi user32 gdi32 winmm ksuser)

add_library(ScoreDawEngine SHARED ${ENGINE_SOURCES} ${SDK_SOURCES})
target_include_directories(ScoreDawEngine PRIVATE ${V} ${clap_SOURCE_DIR}/include ${CMAKE_CURRENT_SOURCE_DIR})
target_compile_definitions(ScoreDawEngine PRIVATE ${DEFS})
target_link_libraries(ScoreDawEngine PRIVATE ${LIBS})

add_executable(ScoreDawScan scan_main.cpp ${ENGINE_SOURCES} ${SDK_SOURCES})
target_include_directories(ScoreDawScan PRIVATE ${V} ${clap_SOURCE_DIR}/include ${CMAKE_CURRENT_SOURCE_DIR})
target_compile_definitions(ScoreDawScan PRIVATE ${DEFS} SDAW_BUILD_DLL)
target_link_libraries(ScoreDawScan PRIVATE ${LIBS})
set_target_properties(ScoreDawEngine ScoreDawScan PROPERTIES RUNTIME_OUTPUT_DIRECTORY_RELEASE ${CMAKE_CURRENT_SOURCE_DIR}/../dist)

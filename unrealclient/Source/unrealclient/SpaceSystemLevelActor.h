#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "Interfaces/IHttpRequest.h"
#include "Interfaces/IHttpResponse.h"
#include "SpaceSystemLevelActor.generated.h"

class UMaterialInstanceDynamic;
class UMaterialInterface;
class UActorComponent;
class UStaticMesh;
class UStaticMeshComponent;
class UTextRenderComponent;
class IWebSocket;

struct FSpaceSystemPlanetView
{
	FString Id;
	FString Name;
	FString Faction;
	FVector2D MapPosition = FVector2D::ZeroVector;
	FLinearColor Color = FLinearColor::White;
	float Scale = 1.0f;
};

struct FSpaceSystemShipView
{
	FString Id;
	FString Name;
	FString Faction;
	FString OwnerClientId;
	FString DestinationPlanetId;
	FVector2D MapPosition = FVector2D::ZeroVector;
	FVector2D DestinationMapPosition = FVector2D::ZeroVector;
	float Fuel = 0.0f;
	float FuelCapacity = 1.0f;
	float Speed = 0.0f;
	double DepartedAtMs = 0.0;
	bool bHasDestination = false;
	bool bHasDepartedAt = false;
};

struct FSpaceSystemExploredAreaView
{
	FVector2D Center = FVector2D::ZeroVector;
	float Radius = 1.0f;
};

struct FSpaceSystemSosSignalView
{
	FString ClientId;
	FString ShipName;
	FVector2D MapPosition = FVector2D::ZeroVector;
	float FuelNeeded = 0.0f;
	float Radius = 1.0f;
};

USTRUCT()
struct FSpaceSystemShipRenderState
{
	GENERATED_BODY()

	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> Mesh = nullptr;

	UPROPERTY()
	TObjectPtr<UTextRenderComponent> Label = nullptr;

	UPROPERTY()
	TObjectPtr<UStaticMeshComponent> DestinationLine = nullptr;

	FString ShipId;
	FString LabelText;
	FVector2D CurrentMapPosition = FVector2D::ZeroVector;
	FVector2D SourceMapPosition = FVector2D::ZeroVector;
	FVector2D TargetMapPosition = FVector2D::ZeroVector;
	FVector2D DestinationMapPosition = FVector2D::ZeroVector;
	FColor LabelColor = FColor::White;
	FLinearColor Color = FLinearColor::White;
	float AnimationElapsedSeconds = 0.0f;
	float AnimationDurationSeconds = 0.0f;
	float Speed = 0.0f;
	bool bHasDestination = false;
	bool bShowDestinationLine = false;
};

UCLASS()
class UNREALCLIENT_API ASpaceSystemLevelActor : public AActor
{
	GENERATED_BODY()

public:
	ASpaceSystemLevelActor();
	virtual void Tick(float DeltaSeconds) override;

protected:
	virtual void BeginPlay() override;
	virtual void EndPlay(const EEndPlayReason::Type EndPlayReason) override;

private:
	UPROPERTY()
	USceneComponent* SceneRoot;

	UPROPERTY()
	UStaticMesh* SphereMesh;

	UPROPERTY()
	UStaticMesh* CubeMesh;

	UPROPERTY()
	UStaticMesh* CylinderMesh;

	UPROPERTY()
	UMaterialInterface* BaseMaterial;

	UPROPERTY()
	UMaterialInterface* TranslucentMaterial;

	TArray<FSpaceSystemPlanetView> Planets;
	TArray<FSpaceSystemShipView> Ships;
	TArray<FSpaceSystemExploredAreaView> ExploredAreas;
	TArray<FSpaceSystemSosSignalView> SosSignals;
	TArray<TObjectPtr<UActorComponent>> RefreshableComponents;
	TArray<TObjectPtr<UTextRenderComponent>> LabelComponents;

	UPROPERTY()
	TMap<FString, FSpaceSystemShipRenderState> RenderedShips;

	UPROPERTY()
	TObjectPtr<UTextRenderComponent> StatusLabel = nullptr;

	TSharedPtr<IWebSocket> WorldSocket;
	FTimerHandle ReconnectTimer;
	FString RefreshableSceneSignature;

	FString ServerHttpBaseUrl = TEXT("http://127.0.0.1:3016");
	FString ServerWebSocketUrl = TEXT("ws://127.0.0.1:3016/ws?client=user&clientId=unreal-client&name=Unreal%20Client");
	FString ClientId = TEXT("unreal-client");
	FString PilotName = TEXT("Unreal Pilot");
	FString ConnectionStatus = TEXT("offline");
	int32 WorldTick = 0;
	double SnapshotAtMs = 0.0;
	double ClockOffsetMs = 0.0;
	bool bSpawnRequested = false;
	bool bUsingLiveSnapshot = false;
	bool bAllowReconnect = true;
	bool bHasRefreshableSceneSignature = false;
	bool bShowMapGrid = false;
	bool bShowShipDestinationLines = false;
	bool bShowTradeRoutes = false;

	void BuildPlanetData();
	void BuildLighting();
	void BuildGrid();
	void BuildStars();
	void FaceLabelsToCamera();
	void RebuildRefreshableScene();
	void ClearRefreshableScene();
	void BuildPlanets();
	void BuildRoutes();
	void BuildSosSignals();
	void BuildShips();
	void TickShipAnimations(float DeltaSeconds);
	void RemoveStaleRenderedShips(const TSet<FString>& LiveShipIds);
	void DestroyRenderedShip(FSpaceSystemShipRenderState& State);
	void UpdateRenderedShipComponents(FSpaceSystemShipRenderState& State);
	void BuildStatusBeacon();
	void UpdateLiveSceneFromSnapshot();
	FString BuildRefreshableSceneSignature() const;
	void ConnectToServer();
	void ScheduleReconnect();
	void HandleSocketConnected();
	void HandleSocketConnectionError(const FString& Error);
	void HandleSocketClosed(int32 StatusCode, const FString& Reason, bool bWasClean);
	void HandleSocketMessage(const FString& Message);
	void ApplyWorldPayload(const TSharedPtr<class FJsonObject>& Payload);
	void RequestSpawnIfNeeded(const TSharedPtr<class FJsonObject>& Payload);
	void HandleSpawnResponse(FHttpRequestPtr Request, FHttpResponsePtr Response, bool bConnectedSuccessfully);

	FVector ToWorldPosition(const FVector2D& MapPosition, float Height = 0.0f) const;
	UMaterialInstanceDynamic* CreateColorMaterial(const FLinearColor& Color, FName Name, UMaterialInterface* MaterialTemplate = nullptr);
	UStaticMeshComponent* AddMesh(FName Name, UStaticMesh* Mesh, const FVector& Location, const FVector& Scale, const FLinearColor& Color, bool bRefreshable = true, UMaterialInterface* MaterialTemplate = nullptr);
	UTextRenderComponent* AddLabel(FName Name, const FString& Text, const FVector& Location, float Size, const FColor& Color, bool bRefreshable = true);
	UStaticMeshComponent* AddCylinderLine(FName Name, const FVector& Start, const FVector& End, float Radius, const FLinearColor& Color, bool bRefreshable = true);
	void UpdateCylinderLine(UStaticMeshComponent* Line, const FVector& Start, const FVector& End, float Radius) const;
	const FSpaceSystemPlanetView* PlanetById(const FString& PlanetId) const;
};